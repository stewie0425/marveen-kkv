// /api/vault/documents -- read-only proxy onto the marveen-rag /documents
// endpoints so the dashboard's Vault page can surface cold-tier promotions
// without the frontend needing direct access to the RAG service token.
//
// Two routes:
//   GET /api/vault/documents?agent=&q=&limit=&offset=  -> paginated list
//   GET /api/vault/documents/:id                       -> full content
//
// When MARVEEN_RAG_TOKEN is unset (sqlite-only deployment), the list
// returns an empty page so the page renders its calm empty state, and
// the detail route 503s. The frontend already 404-tolerates the list.

import { logger } from '../../logger.js'
import { RAG_URL, RAG_TOKEN } from '../../config.js'
import { json } from '../http-helpers.js'
import type { RouteContext } from './types.js'

// Upstream RAG document shapes match what scripts/ingest-kevin-vault.ts
// already exercises. Detail may carry full content under one of a couple
// keys depending on service version -- handled below.
interface RagDocSummary {
  id: string
  agent_id: string
  source_path: string | null
  title: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
  chunk_count?: number
}

interface RagDocList {
  total: number
  limit: number
  offset: number
  documents: RagDocSummary[]
}

interface RagDocDetail extends RagDocSummary {
  content?: string
  body?: string
  chunks?: Array<{ text?: string; content?: string }>
}

const RAG_TIMEOUT_MS = 5_000

function isoToUnix(iso: string | null | undefined): number {
  if (!iso) return 0
  const t = Date.parse(iso)
  return Number.isFinite(t) ? Math.floor(t / 1000) : 0
}

function extractKeywords(meta: Record<string, unknown> | null | undefined): string[] {
  if (!meta) return []
  const k = (meta as Record<string, unknown>)['keywords']
  if (Array.isArray(k)) {
    return k.filter((x): x is string => typeof x === 'string')
  }
  if (typeof k === 'string') {
    return k.split(',').map(s => s.trim()).filter(Boolean)
  }
  return []
}

function toClientSummary(r: RagDocSummary): {
  id: string
  agent_id: string
  title: string
  vault_path: string | null
  keywords: string[]
  created_at: number
  updated_at: number
} {
  const updated = isoToUnix(r.updated_at) || isoToUnix(r.created_at)
  return {
    id: r.id,
    agent_id: r.agent_id,
    title: r.title ?? r.source_path ?? r.id,
    vault_path: r.source_path ?? null,
    keywords: extractKeywords(r.metadata),
    created_at: isoToUnix(r.created_at),
    updated_at: updated,
  }
}

// Stitch chunk[].text into a single string when the detail payload only
// carries chunks (some RAG service versions don't echo the original body).
function stitchChunks(chunks: Array<{ text?: string; content?: string }> | undefined): string {
  if (!chunks || chunks.length === 0) return ''
  return chunks
    .map(c => c.text ?? c.content ?? '')
    .filter(Boolean)
    .join('\n\n')
}

async function ragGet<T>(path: string, params?: URLSearchParams): Promise<T | null> {
  if (!RAG_TOKEN) return null
  const url = new URL(RAG_URL.replace(/\/+$/, '') + path)
  if (params) {
    for (const [k, v] of params) url.searchParams.append(k, v)
  }
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), RAG_TIMEOUT_MS)
  try {
    const resp = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${RAG_TOKEN}` },
      signal: ctrl.signal,
    })
    if (resp.status === 404) return null
    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      throw new Error(`marveen-rag GET ${path} -> ${resp.status}: ${text.slice(0, 300)}`)
    }
    return (await resp.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

// Exported so the overview activity feed can reuse the same proxy + mapper
// without importing the route handler.
export async function fetchRecentVaultDocs(
  limit: number,
): Promise<ReturnType<typeof toClientSummary>[]> {
  if (!RAG_TOKEN) return []
  try {
    const params = new URLSearchParams({ limit: String(limit), offset: '0' })
    const resp = await ragGet<RagDocList>('/documents', params)
    if (!resp || !Array.isArray(resp.documents)) return []
    return resp.documents.map(toClientSummary)
  } catch (err) {
    logger.warn({ err }, 'Recent vault doc fetch failed')
    return []
  }
}

export async function tryHandleVault(ctx: RouteContext): Promise<boolean> {
  const { res, path, method, url } = ctx

  if (path === '/api/vault/documents' && method === 'GET') {
    const agent = (url.searchParams.get('agent') ?? '').trim()
    const q = (url.searchParams.get('q') ?? '').trim()
    const rawLimit = parseInt(url.searchParams.get('limit') ?? '50', 10)
    const limit = Math.min(Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 50, 200)
    const rawOffset = parseInt(url.searchParams.get('offset') ?? '0', 10)
    const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0

    if (!RAG_TOKEN) {
      json(res, { documents: [], total: 0, limit, offset })
      return true
    }

    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
    if (agent) params.set('agent_id', agent)
    if (q) params.set('q', q)

    try {
      const resp = await ragGet<RagDocList>('/documents', params)
      if (!resp) {
        json(res, { documents: [], total: 0, limit, offset })
        return true
      }
      json(res, {
        documents: (resp.documents ?? []).map(toClientSummary),
        total: resp.total ?? 0,
        limit: resp.limit ?? limit,
        offset: resp.offset ?? offset,
      })
    } catch (err) {
      logger.warn({ err }, 'Vault list proxy failed')
      json(res, { error: 'vault unavailable' }, 502)
    }
    return true
  }

  const detailMatch = path.match(/^\/api\/vault\/documents\/([^/]+)$/)
  if (detailMatch && method === 'GET') {
    const id = decodeURIComponent(detailMatch[1])
    if (!RAG_TOKEN) {
      json(res, { error: 'vault not configured' }, 503)
      return true
    }
    try {
      const r = await ragGet<RagDocDetail>(`/documents/${encodeURIComponent(id)}`)
      if (!r) {
        json(res, { error: 'not found' }, 404)
        return true
      }
      const content = r.content ?? r.body ?? stitchChunks(r.chunks)
      json(res, { ...toClientSummary(r), content })
    } catch (err) {
      logger.warn({ err, id }, 'Vault detail proxy failed')
      json(res, { error: 'vault unavailable' }, 502)
    }
    return true
  }

  return false
}
