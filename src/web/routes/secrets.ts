// /api/secrets -- write-only secret distribution to /etc/marveen/*.env
// files via the dashboard. Designed for the operator's own UI ("Titkok"
// page): the operator pastes a value into the password field, the
// backend stores it on disk with mode 0600, and a metadata-only
// registry tracks {name, path, mtime, size} so the page can list what
// is set without ever revealing the value.
//
// Hard rules:
//   - The value never appears in any logger call (route logs name/path/length only).
//   - The value never appears in any response (POST returns {ok, target, size}; GET/DELETE never read it).
//   - The target path must resolve (after symlink resolution) inside /etc/marveen/, end with .env.
//   - The variable name must match POSIX-ish env naming: ^[A-Z][A-Z0-9_]*$.
//   - The value cannot contain a newline (would break .env line semantics).
//   - DELETE removes the line from the env file and the registry; the env file stays on disk.
//
// Auth gate: shared with every other /api/* route -- Bearer required.
// The dashboard token is already operator-equivalent, so no extra
// "Kevin-only" check is needed here.

import { existsSync, readFileSync, statSync, realpathSync } from 'node:fs'
import { dirname, normalize } from 'node:path'
import { atomicWriteFileSync } from '../atomic-write.js'
import { logger } from '../../logger.js'
import { readBody, json } from '../http-helpers.js'
import type { RouteContext } from './types.js'

const ALLOW_DIR = '/etc/marveen'
const REGISTRY_PATH = '/etc/marveen/secrets-registry.json'
const NAME_RX = /^[A-Z][A-Z0-9_]{0,63}$/
const MAX_BODY_BYTES = 64 * 1024

interface SecretEntry {
  name: string
  target_env_path: string
  last_modified: number
  size: number
}

function isSecretEntry(o: unknown): o is SecretEntry {
  if (!o || typeof o !== 'object') return false
  const e = o as Record<string, unknown>
  return typeof e.name === 'string'
    && typeof e.target_env_path === 'string'
    && typeof e.last_modified === 'number'
    && typeof e.size === 'number'
}

function readRegistry(): SecretEntry[] {
  try {
    if (!existsSync(REGISTRY_PATH)) return []
    const data = readFileSync(REGISTRY_PATH, 'utf-8')
    const parsed: unknown = JSON.parse(data)
    return Array.isArray(parsed) ? parsed.filter(isSecretEntry) : []
  } catch (err) {
    logger.warn({ err }, 'Failed to read secrets registry; treating as empty')
    return []
  }
}

function writeRegistry(entries: SecretEntry[]): void {
  atomicWriteFileSync(REGISTRY_PATH, JSON.stringify(entries, null, 2), { mode: 0o600 })
}

interface PathOk { ok: true; resolved: string }
interface PathBad { ok: false; error: string }

// Resolve and whitelist-check the target. realpath on the directory
// closes the symlink-escape route (a /etc/marveen/foo symlinked to
// /etc/passwd would otherwise pass a naive prefix check).
function validatePath(target: string): PathOk | PathBad {
  if (!target || typeof target !== 'string') {
    return { ok: false, error: 'target_env_path required' }
  }
  if (!target.endsWith('.env')) {
    return { ok: false, error: 'target_env_path must end with .env' }
  }
  const norm = normalize(target)
  const dir = dirname(norm)
  if (!existsSync(dir)) {
    return { ok: false, error: 'target_env_path directory does not exist' }
  }
  let real: string
  try {
    real = realpathSync(dir)
  } catch {
    return { ok: false, error: 'target_env_path directory could not be resolved' }
  }
  if (real !== ALLOW_DIR && !real.startsWith(ALLOW_DIR + '/')) {
    return { ok: false, error: `target_env_path must be inside ${ALLOW_DIR}` }
  }
  return { ok: true, resolved: norm }
}

// Replace existing KEY=... line if present, else append. Preserves all
// other lines (other secrets, comments) verbatim. Exported so the unit
// test can pin down the line-edit semantics without a filesystem.
export function lineSet(envBody: string, name: string, value: string): string {
  const lines = envBody.split('\n')
  const prefix = name + '='
  let replaced = false
  const out: string[] = []
  for (const line of lines) {
    if (!replaced && line.startsWith(prefix)) {
      out.push(prefix + value)
      replaced = true
    } else {
      out.push(line)
    }
  }
  if (!replaced) {
    while (out.length > 0 && out[out.length - 1] === '') out.pop()
    out.push(prefix + value)
    out.push('')
  }
  return out.join('\n')
}

export function lineRemove(envBody: string, name: string): { body: string; removed: boolean } {
  const lines = envBody.split('\n')
  const prefix = name + '='
  let removed = false
  const out: string[] = []
  for (const line of lines) {
    if (!removed && line.startsWith(prefix)) {
      removed = true
      continue
    }
    out.push(line)
  }
  return { body: out.join('\n'), removed }
}

function upsertRegistry(entries: SecretEntry[], rec: SecretEntry): SecretEntry[] {
  const out = entries.filter(
    e => !(e.name === rec.name && e.target_env_path === rec.target_env_path),
  )
  out.push(rec)
  return out
}

function removeFromRegistry(
  entries: SecretEntry[],
  name: string,
): { entries: SecretEntry[]; removed: SecretEntry | null } {
  const idx = entries.findIndex(e => e.name === name)
  if (idx < 0) return { entries, removed: null }
  const removed = entries[idx]
  return {
    entries: entries.filter((_, i) => i !== idx),
    removed,
  }
}

export async function tryHandleSecrets(ctx: RouteContext): Promise<boolean> {
  const { req, res, path, method } = ctx

  if (path === '/api/secrets' && method === 'GET') {
    const entries = readRegistry()
    json(res, entries.map(e => ({
      name: e.name,
      target_env_path: e.target_env_path,
      last_modified: e.last_modified,
      size: e.size,
    })))
    return true
  }

  if (path === '/api/secrets' && method === 'POST') {
    let raw: Buffer
    try {
      raw = await readBody(req, { maxBytes: MAX_BODY_BYTES })
    } catch {
      json(res, { error: 'Body too large' }, 413)
      return true
    }
    let parsed: { name?: unknown; value?: unknown; target_env_path?: unknown }
    try {
      parsed = JSON.parse(raw.toString())
    } catch {
      json(res, { error: 'Invalid JSON body' }, 400)
      return true
    }

    const name = typeof parsed.name === 'string' ? parsed.name.trim() : ''
    const value = typeof parsed.value === 'string' ? parsed.value : ''
    const targetIn = typeof parsed.target_env_path === 'string' ? parsed.target_env_path.trim() : ''

    if (!NAME_RX.test(name)) {
      json(res, { error: 'name must match ^[A-Z][A-Z0-9_]*$' }, 400)
      return true
    }
    if (value.length === 0) {
      json(res, { error: 'value required' }, 400)
      return true
    }
    if (value.includes('\n') || value.includes('\r')) {
      json(res, { error: 'value must not contain newlines' }, 400)
      return true
    }

    const v = validatePath(targetIn)
    if (!v.ok) {
      json(res, { error: v.error }, 400)
      return true
    }

    let envBody = ''
    if (existsSync(v.resolved)) {
      try {
        envBody = readFileSync(v.resolved, 'utf-8')
      } catch (err) {
        logger.warn({ err, target: v.resolved }, 'Failed to read existing env file; will overwrite')
      }
    }
    const newBody = lineSet(envBody, name, value)
    atomicWriteFileSync(v.resolved, newBody, { mode: 0o600 })

    const stat = statSync(v.resolved)
    const entry: SecretEntry = {
      name,
      target_env_path: v.resolved,
      last_modified: Math.floor(stat.mtimeMs / 1000),
      size: stat.size,
    }
    writeRegistry(upsertRegistry(readRegistry(), entry))

    logger.info(
      { name, target_env_path: v.resolved, length: value.length },
      'Secret written',
    )
    json(res, { ok: true, target: v.resolved, size: stat.size })
    return true
  }

  const detailMatch = path.match(/^\/api\/secrets\/([^/]+)$/)
  if (detailMatch && method === 'DELETE') {
    const name = decodeURIComponent(detailMatch[1])
    if (!NAME_RX.test(name)) {
      json(res, { error: 'invalid name' }, 400)
      return true
    }
    const reg = readRegistry()
    const entry = reg.find(e => e.name === name)
    if (!entry) {
      json(res, { error: 'not found' }, 404)
      return true
    }
    if (existsSync(entry.target_env_path)) {
      const v = validatePath(entry.target_env_path)
      if (v.ok) {
        try {
          const cur = readFileSync(v.resolved, 'utf-8')
          const { body: newBody, removed } = lineRemove(cur, name)
          if (removed) {
            atomicWriteFileSync(v.resolved, newBody, { mode: 0o600 })
          }
        } catch (err) {
          logger.warn({ err, name }, 'Secret env-line removal failed')
        }
      }
    }
    const { entries: nextReg } = removeFromRegistry(reg, name)
    writeRegistry(nextReg)
    logger.info(
      { name, target_env_path: entry.target_env_path },
      'Secret deleted',
    )
    json(res, { ok: true })
    return true
  }

  return false
}
