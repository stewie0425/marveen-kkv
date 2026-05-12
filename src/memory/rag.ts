// HTTP client for the marveen-rag service (FastAPI on 10.92.0.214:8088).
//
// Reconciled against /openapi.json (Marveen RAG 0.2.0):
//   - List endpoints (`/memory`, `/daily-log`, `/documents`) return a
//     pagination wrapper `{ total, limit, offset, <items_field>: [...] }`
//     — items_field is `memories` / `entries` / `documents`.
//   - `/search` is POST, body=SearchRequest, and returns SearchHit chunks
//     from the vault corpus — NOT MemoryRecords — so it is unsuitable for the
//     dashboard's memory search. Hybrid memory search currently degrades to
//     the same `/memory?q=...` FTS lookup as plain mode; this is documented
//     and we'll revisit if the service adds a memory-level hybrid endpoint.
//   - Cold tier requires a two-step write: POST /memory (live tier) followed
//     by POST /memory/promote with {id, to_tier:'cold', write_vault, git_commit}.
//     The service deletes the live row and returns a vault document_id.
//   - PATCH /memory/{id} body = MemoryUpdate. Notably it has NO agent_id
//     field; the dashboard's old SQLite update API allowed agent_id reassign,
//     RAG does not.
//   - POST /memory body = MemoryCreate. `auto_generated` is NOT a top-level
//     field — we pack it into `metadata.auto_generated` so the dashboard's
//     "agent vs human entry" flag survives the round-trip.
//   - Daily log uses `day` (not `date`) and lists by `from`/`to` ISO range.
//
// Tier routing:
//   hot|warm|shared  -> POST /memory (one round trip)
//   cold             -> POST /memory + POST /memory/promote (two round trips)

import type {
  MemoryBackend,
  SaveMemoryInput,
  UpdateMemoryInput,
  DashboardMemory,
  MemoryStats,
  DailyLogEntry,
  SearchMode,
  MemoryCategory,
} from './backend.js'

interface RagMemoryRow {
  id: string
  agent_id: string
  content: string
  tier: 'hot' | 'warm' | 'shared'
  category: string | null
  keywords: string[] | null
  metadata: Record<string, unknown> | null
  expires_at: string | null
  created_at: string  // ISO 8601
  updated_at: string
}

interface RagDailyLogRow {
  id: string
  agent_id: string
  day: string
  content: string
  created_at: string
}

interface RagListResponse<T, K extends string> {
  total: number
  limit: number
  offset: number
  // Item-array key varies by endpoint: 'memories' | 'entries' | 'documents'.
  // We use a generic K to keep the unwrap call-sites type-safe.
  memories?: T[]
  entries?: T[]
  documents?: T[]
}
type ListPayload<T> = RagListResponse<T, 'memories' | 'entries' | 'documents'>

interface RagPromoteResponse {
  id: string
  to_tier: string
  document_id: string | null
  vault_path: string | null
  chunks: number | null
  git_commit: string | null
  deleted_memory: boolean
}

function isoToUnix(iso: string | null | undefined): number {
  if (!iso) return 0
  const t = Date.parse(iso)
  return Number.isFinite(t) ? Math.floor(t / 1000) : 0
}

function keywordsToString(kw: string[] | null | undefined): string | null {
  if (!kw || kw.length === 0) return null
  return kw.join(', ')
}

function keywordsFromString(kw: string | undefined): string[] {
  if (!kw) return []
  return kw.split(',').map(k => k.trim()).filter(k => k.length > 0)
}

function toDashboard(r: RagMemoryRow): DashboardMemory {
  const auto = r.metadata && typeof r.metadata === 'object' && (r.metadata as Record<string, unknown>).auto_generated
  return {
    id: r.id,
    agent_id: r.agent_id,
    content: r.content,
    // RAG `tier` is the dashboard's `category` (legacy naming clash).
    category: r.tier as MemoryCategory,
    keywords: keywordsToString(r.keywords),
    auto_generated: auto ? 1 : 0,
    // RAG has no accessed_at; the dashboard sorts by it, so fall back to
    // updated_at (touched on PATCH) and finally created_at.
    created_at: isoToUnix(r.created_at),
    accessed_at: isoToUnix(r.updated_at) || isoToUnix(r.created_at),
  }
}

function dayBoundsIso(date: string): { from: string; to: string } {
  // YYYY-MM-DD -> [YYYY-MM-DDT00:00:00Z, YYYY-MM-DDT23:59:59.999Z]
  return { from: `${date}T00:00:00Z`, to: `${date}T23:59:59.999Z` }
}

export class RagMemoryBackend implements MemoryBackend {
  readonly kind = 'rag' as const

  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async req<T>(method: string, path: string, body?: unknown, params?: URLSearchParams): Promise<T> {
    const url = new URL(this.baseUrl.replace(/\/+$/, '') + path)
    if (params) {
      for (const [k, v] of params) url.searchParams.append(k, v)
    }
    const init: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }
    const resp = await this.fetchImpl(url.toString(), init)
    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      throw new Error(`marveen-rag ${method} ${path} -> ${resp.status}: ${text.slice(0, 500)}`)
    }
    if (resp.status === 204) return undefined as T
    const ctype = resp.headers.get('content-type') ?? ''
    if (ctype.includes('application/json')) {
      return (await resp.json()) as T
    }
    return (await resp.text()) as unknown as T
  }

  async saveMemory(input: SaveMemoryInput): Promise<{ id: number | string }> {
    // auto_generated is not a first-class MemoryCreate field, but the
    // dashboard relies on it. Round-trip it through metadata so the GET
    // path reconstructs the original flag.
    const metadata = {
      ...(input.metadata ?? {}),
      ...(input.auto_generated !== undefined ? { auto_generated: !!input.auto_generated } : {}),
    }
    if (input.category === 'cold') {
      // Two-step: write to a live tier first, then promote into the vault.
      // Picking 'warm' as the staging tier; the rag service deletes it
      // on promote (deleted_memory:true) so it doesn't linger.
      const created = await this.req<RagMemoryRow>('POST', '/memory', {
        agent_id: input.agent_id,
        content: input.content,
        tier: 'warm',
        keywords: keywordsFromString(input.keywords),
        metadata,
      })
      const promoted = await this.req<RagPromoteResponse>('POST', '/memory/promote', {
        id: created.id,
        to_tier: 'cold',
        write_vault: true,
        git_commit: true,
      })
      // The live row is gone; the vault document is the canonical reference.
      // Return the document_id when present (it's the durable handle for
      // anything that wants to find this content again), falling back to
      // the original memory id which the service may still answer for.
      return { id: promoted.document_id ?? promoted.id }
    }
    const row = await this.req<RagMemoryRow>('POST', '/memory', {
      agent_id: input.agent_id,
      content: input.content,
      tier: input.category,
      keywords: keywordsFromString(input.keywords),
      metadata,
    })
    return { id: row.id }
  }

  async getMemoriesForAgent(agentId: string, limit: number): Promise<DashboardMemory[]> {
    const params = new URLSearchParams({ agent_id: agentId, limit: String(limit) })
    const resp = await this.req<ListPayload<RagMemoryRow>>('GET', '/memory', undefined, params)
    return (resp.memories ?? []).map(toDashboard)
  }

  async searchMemories(
    agentId: string,
    query: string,
    limit: number,
    _mode: SearchMode,
  ): Promise<DashboardMemory[]> {
    // NOTE: /search returns SearchHit (vault chunk corpus), not MemoryRecord
    // — so it is NOT a memory-tier search. Both modes route through the
    // FTS-equipped /memory?q= for now. When the service exposes a hybrid
    // memory-record search we'll wire it back in.
    const params = new URLSearchParams({
      agent_id: agentId,
      q: query,
      limit: String(limit),
    })
    const resp = await this.req<ListPayload<RagMemoryRow>>('GET', '/memory', undefined, params)
    return (resp.memories ?? []).map(toDashboard)
  }

  async updateMemory(id: number | string, updates: UpdateMemoryInput): Promise<boolean> {
    // MemoryUpdate has no agent_id; RAG does not allow re-assigning a
    // memory to a different agent. We silently drop any agent_id passed in.
    const payload: Record<string, unknown> = {}
    if (updates.content !== undefined) payload.content = updates.content
    if (updates.category !== undefined) payload.tier = updates.category
    if (updates.keywords !== undefined) payload.keywords = keywordsFromString(updates.keywords)
    try {
      await this.req<RagMemoryRow>('PATCH', `/memory/${encodeURIComponent(String(id))}`, payload)
      return true
    } catch (err) {
      if (err instanceof Error && /\b404\b/.test(err.message)) return false
      throw err
    }
  }

  async deleteMemory(id: number | string): Promise<boolean> {
    try {
      await this.req<unknown>('DELETE', `/memory/${encodeURIComponent(String(id))}`)
      return true
    } catch (err) {
      if (err instanceof Error && /\b404\b/.test(err.message)) return false
      throw err
    }
  }

  async getStats(): Promise<MemoryStats> {
    // /memory/stats is not exposed; derive stats from a bounded listing so
    // the dashboard's stats panel keeps a result. Service caps `limit` so
    // this is approximate for very large stores.
    const params = new URLSearchParams({ limit: '1000' })
    const resp = await this.req<ListPayload<RagMemoryRow>>('GET', '/memory', undefined, params)
    const rows = resp.memories ?? []
    const byAgent: Record<string, number> = {}
    const byTier: Record<string, number> = {}
    for (const r of rows) {
      byAgent[r.agent_id] = (byAgent[r.agent_id] ?? 0) + 1
      byTier[r.tier] = (byTier[r.tier] ?? 0) + 1
    }
    return {
      total: resp.total ?? rows.length,
      byAgent,
      byTier,
      // Embeddings live in pgvector server-side; the dashboard counter is
      // not meaningful here. Surface 0 so the UI shows the row but doesn't
      // misrepresent SQLite-style "needs backfill" state.
      withEmbedding: 0,
    }
  }

  async appendDailyLog(agentId: string, content: string): Promise<void> {
    await this.req<unknown>('POST', '/daily-log', { agent_id: agentId, content })
  }

  async getDailyLog(agentId: string, date: string): Promise<DailyLogEntry[]> {
    // Service filters by `from`/`to` ISO range, NOT a single `date` param.
    const { from, to } = dayBoundsIso(date)
    const params = new URLSearchParams({ agent_id: agentId, from, to, limit: '1000' })
    const resp = await this.req<ListPayload<RagDailyLogRow>>('GET', '/daily-log', undefined, params)
    return (resp.entries ?? []).map(r => ({
      id: r.id,
      content: r.content,
      created_at: isoToUnix(r.created_at),
    }))
  }

  async getDailyLogDates(agentId: string, limit = 14): Promise<string[]> {
    // No /daily-log/dates endpoint. Project from a wide listing.
    const params = new URLSearchParams({ agent_id: agentId, limit: String(limit * 50) })
    const resp = await this.req<ListPayload<RagDailyLogRow>>('GET', '/daily-log', undefined, params)
    const seen = new Set<string>()
    for (const r of resp.entries ?? []) {
      // The `day` field is already YYYY-MM-DD; prefer it over slicing
      // created_at, which would float into the next day for late-evening UTC.
      if (r.day) seen.add(r.day)
    }
    return [...seen].sort().reverse().slice(0, limit)
  }
}
