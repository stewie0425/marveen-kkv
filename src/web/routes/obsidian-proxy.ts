// /api/obsidian/* -- reverse-proxy for the Obsidian Local REST API
// running on LXC 119 (10.92.0.185:27124, HTTPS self-signed).
//
// Rationale: the browser cannot call the Obsidian API directly because:
//   - self-signed cert -> browser blocks untrusted HTTPS
//   - CORS: Obsidian plugin does not emit Access-Control-Allow-Origin
//
// Endpoints:
//   GET  /api/obsidian/tree?path=        -> directory listing (flat -> tree)
//   GET  /api/obsidian/file?path=X       -> markdown file content
//   GET  /api/obsidian/search?q=X        -> simple text search
//
// Token: read from /etc/marveen/obsidian-rest.env (OBSIDIAN_API_KEY=...).
// If the file is absent the endpoints return 503 with a hint.

import { existsSync, readFileSync } from 'node:fs'
import { logger } from '../../logger.js'
import { json } from '../http-helpers.js'
import type { RouteContext } from './types.js'

const OBSIDIAN_URL = process.env.OBSIDIAN_URL ?? 'https://localhost:27124'
const TOKEN_ENV_FILE = '/etc/marveen/obsidian-rest.env'
const OBSIDIAN_TIMEOUT_MS = 8_000

function readObsidianToken(): string {
  try {
    if (!existsSync(TOKEN_ENV_FILE)) return ''
    const raw = readFileSync(TOKEN_ENV_FILE, 'utf-8')
    for (const line of raw.split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const eq = t.indexOf('=')
      if (eq === -1) continue
      const key = t.slice(0, eq).trim()
      if (key !== 'OBSIDIAN_API_KEY') continue
      let val = t.slice(eq + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      return val
    }
    return ''
  } catch {
    return ''
  }
}

// Bun supports tls.rejectUnauthorized on fetch; Node does not without an
// https.Agent. This runs under Bun so we use the Bun-specific option.
async function obsidianFetch(path: string, opts?: { method?: string; body?: string }): Promise<Response> {
  const url = `${OBSIDIAN_URL}${path}`
  const token = readObsidianToken()
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), OBSIDIAN_TIMEOUT_MS)

  try {
    return await fetch(url, {
      method: opts?.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: opts?.body,
      signal: ctrl.signal,
      // @ts-expect-error Bun-specific TLS option to allow self-signed certs
      tls: { rejectUnauthorized: false },
    })
  } finally {
    clearTimeout(timer)
  }
}

// Build a nested tree from a flat list of vault-relative paths like
// ["00 - Áttekintés/note.md", "Marveen/Memóriák/foo.md", "top.md"]
export interface TreeNode {
  name: string
  path: string
  type: 'file' | 'folder'
  children?: TreeNode[]
}

function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode[] = []

  for (const filePath of paths.sort()) {
    const parts = filePath.split('/')
    let level = root

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isLast = i === parts.length - 1
      const currentPath = parts.slice(0, i + 1).join('/')

      if (isLast) {
        level.push({ name: part, path: filePath, type: 'file' })
      } else {
        let folder = level.find(n => n.type === 'folder' && n.name === part)
        if (!folder) {
          folder = { name: part, path: currentPath, type: 'folder', children: [] }
          level.push(folder)
        }
        level = folder.children!
      }
    }
  }

  return root
}

function noToken(res: RouteContext['res']) {
  json(
    res,
    {
      error: 'obsidian_not_configured',
      hint: 'Create /etc/marveen/obsidian-rest.env with OBSIDIAN_API_KEY=<token>',
    },
    503,
  )
}

export async function tryHandleObsidian(ctx: RouteContext): Promise<boolean> {
  const { res, path, method } = ctx

  if (!path.startsWith('/api/obsidian/')) return false
  if (method !== 'GET') return false

  const token = readObsidianToken()
  if (!token) {
    noToken(res)
    return true
  }

  // --- tree ---
  if (path === '/api/obsidian/tree') {
    try {
      const resp = await obsidianFetch('/vault/')
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '')
        logger.warn({ status: resp.status }, 'Obsidian tree list failed')
        json(res, { error: `obsidian ${resp.status}`, detail: txt.slice(0, 200) }, 502)
        return true
      }
      const data = await resp.json() as { files?: string[] }
      const files = (data.files ?? []).filter(
        (f: string) => f.endsWith('.md') || f.endsWith('.canvas'),
      )
      json(res, { tree: buildTree(files) })
    } catch (err) {
      logger.warn({ err }, 'Obsidian tree proxy failed')
      json(res, { error: 'obsidian_unreachable' }, 502)
    }
    return true
  }

  // --- file content ---
  if (path === '/api/obsidian/file') {
    const filePath = ctx.url.searchParams.get('path') ?? ''
    if (!filePath) {
      json(res, { error: 'path required' }, 400)
      return true
    }
    // Guard: no traversal outside vault
    if (filePath.includes('..') || filePath.startsWith('/')) {
      json(res, { error: 'invalid path' }, 400)
      return true
    }
    try {
      const resp = await fetch(`${OBSIDIAN_URL}/vault/${encodeURI(filePath)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.olrapi.note+json',
        },
        // @ts-expect-error Bun-specific
        tls: { rejectUnauthorized: false },
      })
      if (resp.status === 404) {
        json(res, { error: 'not found' }, 404)
        return true
      }
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '')
        json(res, { error: `obsidian ${resp.status}`, detail: txt.slice(0, 200) }, 502)
        return true
      }
      const contentType = resp.headers.get('content-type') ?? ''
      if (contentType.includes('application/json') || contentType.includes('vnd.olrapi')) {
        const data = await resp.json() as { content?: string; stat?: unknown }
        json(res, { path: filePath, content: data.content ?? '', stat: data.stat ?? null })
      } else {
        const text = await resp.text()
        json(res, { path: filePath, content: text, stat: null })
      }
    } catch (err) {
      logger.warn({ err, filePath }, 'Obsidian file proxy failed')
      json(res, { error: 'obsidian_unreachable' }, 502)
    }
    return true
  }

  // --- search ---
  if (path === '/api/obsidian/search') {
    const q = ctx.url.searchParams.get('q') ?? ''
    if (!q.trim()) {
      json(res, { results: [] })
      return true
    }
    try {
      const resp = await fetch(`${OBSIDIAN_URL}/search/simple/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: q }),
        // @ts-expect-error Bun-specific
        tls: { rejectUnauthorized: false },
      })
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '')
        json(res, { error: `obsidian ${resp.status}`, detail: txt.slice(0, 200) }, 502)
        return true
      }
      const results = await resp.json()
      json(res, { results })
    } catch (err) {
      logger.warn({ err }, 'Obsidian search proxy failed')
      json(res, { error: 'obsidian_unreachable' }, 502)
    }
    return true
  }

  return false
}
