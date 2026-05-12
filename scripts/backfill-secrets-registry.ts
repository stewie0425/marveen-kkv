#!/usr/bin/env tsx
//
// One-shot backfill: every KEY=... line under /etc/marveen/*.env becomes a
// SecretEntry in /etc/marveen/secrets-registry.json. The dashboard "Titkok"
// page already speaks this schema (src/web/routes/secrets.ts), so existing
// rows authored via the UI are preserved verbatim and only missing rows
// are appended. Idempotent: re-running with no new keys is a no-op.
//
// Hard rules carried over from secrets.ts:
//   - Never read or log a value. Only file-level metadata
//     (target_env_path, last_modified, size) and the key name.
//   - Skip any name that does not match ^[A-Z][A-Z0-9_]{0,63}$ (registry
//     route would refuse it on POST anyway).
//   - The registry file itself is owned root:root mode 0600.
//
// Usage:
//   tsx scripts/backfill-secrets-registry.ts            # dry-run
//   tsx scripts/backfill-secrets-registry.ts --execute  # write registry
//
// A backup of the existing registry is taken automatically before any
// write (registry-path + .bak.<unix-ts>).

import { readFileSync, readdirSync, statSync, copyFileSync, writeFileSync, renameSync } from 'node:fs'
import { join } from 'node:path'

const ALLOW_DIR = '/etc/marveen'
const REGISTRY_PATH = join(ALLOW_DIR, 'secrets-registry.json')
const NAME_RX = /^[A-Z][A-Z0-9_]{0,63}$/

interface SecretEntry {
  name: string
  target_env_path: string
  last_modified: number
  size: number
}

function readRegistry(): SecretEntry[] {
  try {
    const raw = readFileSync(REGISTRY_PATH, 'utf-8')
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as SecretEntry[]) : []
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw err
  }
}

function listEnvFiles(): string[] {
  return readdirSync(ALLOW_DIR)
    .filter(n => n.endsWith('.env'))
    .map(n => join(ALLOW_DIR, n))
}

function extractKeys(envBody: string): string[] {
  const out: string[] = []
  for (const line of envBody.split('\n')) {
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const name = line.slice(0, eq)
    if (!NAME_RX.test(name)) continue
    if (out.includes(name)) continue // dedup within file
    out.push(name)
  }
  return out
}

function main(): number {
  const execute = process.argv.includes('--execute')
  const existing = readRegistry()
  const haveKey = new Set(
    existing.map(e => `${e.name}|${e.target_env_path}`),
  )

  const additions: SecretEntry[] = []
  const skipped: { file: string; reason: string }[] = []

  for (const path of listEnvFiles()) {
    let body: string
    let stat
    try {
      body = readFileSync(path, 'utf-8')
      stat = statSync(path)
    } catch (err) {
      skipped.push({ file: path, reason: `read: ${(err as Error).message}` })
      continue
    }
    const keys = extractKeys(body)
    if (keys.length === 0) {
      skipped.push({ file: path, reason: 'no valid KEY= lines' })
      continue
    }
    const last_modified = Math.floor(stat.mtimeMs / 1000)
    const size = stat.size
    for (const name of keys) {
      const k = `${name}|${path}`
      if (haveKey.has(k)) continue
      additions.push({ name, target_env_path: path, last_modified, size })
      haveKey.add(k)
    }
  }

  console.log(`registry path:    ${REGISTRY_PATH}`)
  console.log(`existing entries: ${existing.length}`)
  console.log(`new entries:      ${additions.length}`)
  if (skipped.length > 0) {
    console.log(`skipped files:    ${skipped.length}`)
    for (const s of skipped) console.log(`  - ${s.file}: ${s.reason}`)
  }
  console.log('')

  for (const e of additions) {
    console.log(`  + ${e.name.padEnd(28)} ${e.target_env_path}`)
  }

  if (additions.length === 0) {
    console.log('')
    console.log('Nothing to add. Registry already complete.')
    return 0
  }

  if (!execute) {
    console.log('')
    console.log('DRY-RUN. Re-run with --execute to write.')
    return 0
  }

  const backup = `${REGISTRY_PATH}.bak.${Math.floor(Date.now() / 1000)}`
  try {
    copyFileSync(REGISTRY_PATH, backup)
    console.log(`backup written:   ${backup}`)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
  }

  const next = [...existing, ...additions]
  const tmp = `${REGISTRY_PATH}.tmp.${process.pid}`
  writeFileSync(tmp, JSON.stringify(next, null, 2), { mode: 0o600 })
  // Atomic rename keeps the dashboard's reader from ever observing partial JSON.
  renameSync(tmp, REGISTRY_PATH)

  console.log('')
  console.log(`wrote ${next.length} entries to ${REGISTRY_PATH}`)
  return 0
}

process.exit(main())
