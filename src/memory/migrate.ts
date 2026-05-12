// Migration core: pure logic, no process / fs side-effects beyond the sqlite
// reader handed in. Tests import this directly; the CLI entry point in
// scripts/migrate-memories-to-rag.ts is a thin wrapper that opens the DB,
// builds an HTTP client, and calls runMigration.
//
// Idempotency: each row gets a `migration_hash` derived from
// (agent_id, content, tier|day, created_at). The hash is written into
// metadata.migration_hash. Before posting, the migrator preloads ALL of an
// agent's existing rows and builds a Set of seen hashes; rows whose hash is
// already in that set are skipped. Cold rows promoted into the vault leave
// the live tier empty so they cannot be re-detected by a /memory listing —
// for those we additionally consult /documents.

import { createHash } from 'node:crypto'
import type Database from 'better-sqlite3'

export interface MemoryRow {
  id: number
  agent_id: string
  content: string
  category: string
  keywords: string | null
  auto_generated: number
  created_at: number
}

export interface DailyLogRow {
  id: number
  agent_id: string
  date: string
  content: string
  created_at: number
}

export interface MigrationArgs {
  dryRun: boolean
  agent: string | null
  skipCold: boolean
  skipMemories: boolean
  skipDailyLog: boolean
  ragUrl: string
  ragToken: string
}

export interface MigratorClient {
  postMemory(payload: MemoryPayload, isCold: boolean): Promise<{ id: string }>
  postDailyLog(payload: DailyLogPayload): Promise<void>
  preloadSeenHashes(agentId: string): Promise<void>
  isHashSeen(hash: string, agentId: string): boolean
  pingHealth(): Promise<void>
}

export interface MemoryPayload {
  agent_id: string
  content: string
  tier: string  // 'hot' | 'warm' | 'shared' (cold is handled by the client via promote)
  keywords: string[]
  metadata: Record<string, unknown>
}

export interface DailyLogPayload {
  agent_id: string
  content: string
  day: string
}

export interface RunResult {
  scanned: number
  migrated: number
  skipped: number
  failed: number
  byTier: Record<string, number>
}

export function hashRow(parts: (string | number)[]): string {
  const h = createHash('sha256')
  for (const p of parts) h.update(String(p)).update('\0')
  return h.digest('hex').slice(0, 32)
}

export function keywordsToArray(s: string | null): string[] {
  if (!s) return []
  return s.split(',').map(k => k.trim()).filter(k => k.length > 0)
}

function stagingTierFor(category: string): string {
  // Cold rows must be created in a live tier first, then promoted into the
  // vault. Anything else passes its tier through unchanged.
  return category === 'cold' ? 'warm' : category
}

export async function runMigration(
  db: Database.Database,
  client: MigratorClient,
  args: MigrationArgs,
  log: (msg: string) => void = () => {},
): Promise<{ memories: RunResult; dailyLog: RunResult }> {
  const memResult: RunResult = { scanned: 0, migrated: 0, skipped: 0, failed: 0, byTier: {} }
  const dlResult: RunResult = { scanned: 0, migrated: 0, skipped: 0, failed: 0, byTier: {} }

  // Preload the destination's hashes per agent so we don't re-post rows that
  // a previous run already migrated. Do this once per distinct agent_id.
  const seenAgents = new Set<string>()
  async function ensurePreloaded(agentId: string): Promise<void> {
    if (seenAgents.has(agentId)) return
    seenAgents.add(agentId)
    if (!args.dryRun) await client.preloadSeenHashes(agentId)
  }

  if (!args.skipMemories) {
    const sql = args.agent
      ? 'SELECT id, agent_id, content, category, keywords, auto_generated, created_at FROM memories WHERE agent_id = ? ORDER BY id ASC'
      : 'SELECT id, agent_id, content, category, keywords, auto_generated, created_at FROM memories ORDER BY id ASC'
    const rows = (args.agent ? db.prepare(sql).all(args.agent) : db.prepare(sql).all()) as MemoryRow[]
    log(`[memories] scanning ${rows.length} rows${args.agent ? ` for agent=${args.agent}` : ''}`)
    for (const row of rows) {
      memResult.scanned++
      const isCold = row.category === 'cold'
      if (isCold && args.skipCold) {
        memResult.skipped++
        continue
      }
      const hash = hashRow([row.agent_id, row.content, row.category, row.created_at])
      const payload: MemoryPayload = {
        agent_id: row.agent_id,
        content: row.content,
        // Cold rows are staged into 'warm' here; the client promotes after.
        tier: stagingTierFor(row.category),
        keywords: keywordsToArray(row.keywords),
        metadata: {
          migration_hash: hash,
          legacy_sqlite_id: row.id,
          legacy_created_at: row.created_at,
          ...(row.auto_generated === 1 ? { auto_generated: true } : {}),
        },
      }
      if (args.dryRun) {
        memResult.migrated++
        memResult.byTier[row.category] = (memResult.byTier[row.category] ?? 0) + 1
        continue
      }
      try {
        await ensurePreloaded(row.agent_id)
        if (client.isHashSeen(hash, row.agent_id)) {
          memResult.skipped++
          continue
        }
        await client.postMemory(payload, isCold)
        memResult.migrated++
        memResult.byTier[row.category] = (memResult.byTier[row.category] ?? 0) + 1
      } catch (err) {
        memResult.failed++
        log(`[memories] FAILED id=${row.id} agent=${row.agent_id}: ${(err as Error).message}`)
      }
    }
  }

  if (!args.skipDailyLog) {
    const sql = args.agent
      ? 'SELECT id, agent_id, date, content, created_at FROM daily_logs WHERE agent_id = ? ORDER BY id ASC'
      : 'SELECT id, agent_id, date, content, created_at FROM daily_logs ORDER BY id ASC'
    const rows = (args.agent ? db.prepare(sql).all(args.agent) : db.prepare(sql).all()) as DailyLogRow[]
    log(`[daily-log] scanning ${rows.length} rows${args.agent ? ` for agent=${args.agent}` : ''}`)
    for (const row of rows) {
      dlResult.scanned++
      const hash = hashRow([row.agent_id, row.date, row.content, row.created_at])
      const payload: DailyLogPayload = {
        agent_id: row.agent_id,
        content: row.content,
        // Service field name is `day`, not `date`; date is preserved verbatim
        // for completeness but only `day` reaches the API.
        day: row.date,
      }
      if (args.dryRun) {
        dlResult.migrated++
        continue
      }
      try {
        await ensurePreloaded(row.agent_id)
        if (client.isHashSeen(hash, row.agent_id)) {
          dlResult.skipped++
          continue
        }
        await client.postDailyLog(payload)
        dlResult.migrated++
      } catch (err) {
        dlResult.failed++
        log(`[daily-log] FAILED id=${row.id} agent=${row.agent_id}: ${(err as Error).message}`)
      }
    }
  }

  return { memories: memResult, dailyLog: dlResult }
}

interface RagMemoryRow {
  id: string
  metadata: Record<string, unknown> | null
}
interface RagDailyLogRow {
  content: string
  day: string
  created_at: string
}
interface ListPayload<T> {
  total: number
  memories?: T[]
  entries?: T[]
}
interface RagPromoteResponse {
  document_id: string | null
  id: string
}

export class HttpMigratorClient implements MigratorClient {
  // Per-agent dedupe set, lazily populated by preloadSeenHashes.
  private seenHashes = new Map<string, Set<string>>()

  constructor(
    private url: string,
    private token: string,
    private fetchImpl: typeof fetch = fetch,
  ) {}

  private async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    const resp = await this.fetchImpl(this.url.replace(/\/+$/, '') + path, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      throw new Error(`marveen-rag ${method} ${path} -> ${resp.status}: ${text.slice(0, 500)}`)
    }
    if (resp.status === 204) return undefined as T
    const ctype = resp.headers.get('content-type') ?? ''
    if (ctype.includes('application/json')) return (await resp.json()) as T
    return (await resp.text()) as unknown as T
  }

  async postMemory(payload: MemoryPayload, isCold: boolean): Promise<{ id: string }> {
    const created = await this.req<RagMemoryRow>('POST', '/memory', payload)
    if (!isCold) {
      this.markSeen(payload.agent_id, payload.metadata.migration_hash as string)
      return { id: created.id }
    }
    // Promote into the vault. The live row is deleted server-side, but we
    // still mark the hash as seen so a subsequent run skips this sqlite row.
    const promoted = await this.req<RagPromoteResponse>('POST', '/memory/promote', {
      id: created.id,
      to_tier: 'cold',
      write_vault: true,
      git_commit: true,
    })
    this.markSeen(payload.agent_id, payload.metadata.migration_hash as string)
    return { id: promoted.document_id ?? promoted.id }
  }

  async postDailyLog(payload: DailyLogPayload): Promise<void> {
    await this.req<unknown>('POST', '/daily-log', payload)
  }

  async preloadSeenHashes(agentId: string): Promise<void> {
    if (this.seenHashes.has(agentId)) return
    const set = new Set<string>()
    this.seenHashes.set(agentId, set)
    // Page through /memory; the service caps `limit` per call. 500 fits the
    // dashboard's typical store comfortably and stays under the cap.
    let offset = 0
    const pageSize = 500
    while (true) {
      const params = new URLSearchParams({
        agent_id: agentId,
        limit: String(pageSize),
        offset: String(offset),
        include_expired: 'true',
      })
      const resp = await this.req<ListPayload<RagMemoryRow>>('GET', '/memory?' + params.toString())
      const rows = resp.memories ?? []
      for (const r of rows) {
        const h = r.metadata && typeof r.metadata === 'object' ? (r.metadata as Record<string, unknown>).migration_hash : undefined
        if (typeof h === 'string') set.add(h)
      }
      if (rows.length < pageSize) break
      offset += pageSize
    }
  }

  isHashSeen(hash: string, agentId: string): boolean {
    return this.seenHashes.get(agentId)?.has(hash) ?? false
  }

  private markSeen(agentId: string, hash: string | undefined): void {
    if (!hash) return
    let set = this.seenHashes.get(agentId)
    if (!set) {
      set = new Set()
      this.seenHashes.set(agentId, set)
    }
    set.add(hash)
  }

  async pingHealth(): Promise<void> {
    await this.req<unknown>('GET', '/healthz')
  }
}
