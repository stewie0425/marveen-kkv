import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Database from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { runMigration, type MemoryPayload, type DailyLogPayload, type MigratorClient } from '../migrate.js'

interface PostedMemory { payload: MemoryPayload; isCold: boolean }

class FakeMigratorClient implements MigratorClient {
  postedMemories: PostedMemory[] = []
  postedDailyLogs: DailyLogPayload[] = []
  seenHashes = new Map<string, Set<string>>()
  failures: { kind: 'memory' | 'dailyLog'; afterCount: number } | null = null

  async postMemory(payload: MemoryPayload, isCold: boolean): Promise<{ id: string }> {
    if (this.failures?.kind === 'memory' && this.postedMemories.length >= this.failures.afterCount) {
      throw new Error('simulated rag outage')
    }
    this.postedMemories.push({ payload, isCold })
    const hash = payload.metadata.migration_hash as string | undefined
    if (hash) this.markSeen(payload.agent_id, hash)
    return { id: `id-${this.postedMemories.length}` }
  }

  async postDailyLog(payload: DailyLogPayload): Promise<void> {
    this.postedDailyLogs.push(payload)
  }

  async preloadSeenHashes(_agentId: string): Promise<void> {
    /* no-op for tests; the test populates seenHashes directly when needed */
  }

  isHashSeen(hash: string, agentId: string): boolean {
    return this.seenHashes.get(agentId)?.has(hash) ?? false
  }

  private markSeen(agentId: string, hash: string): void {
    let set = this.seenHashes.get(agentId)
    if (!set) {
      set = new Set()
      this.seenHashes.set(agentId, set)
    }
    set.add(hash)
  }

  async pingHealth(): Promise<void> {}
}

function seedDb(): { db: Database.Database; path: string; dir: string } {
  const dir = mkdtempSync(join(tmpdir(), 'marveen-migrate-test-'))
  const dbPath = join(dir, 'test.db')
  const db = new Database(dbPath)
  db.exec(`
    CREATE TABLE memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL,
      category TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      keywords TEXT,
      auto_generated INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE daily_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id TEXT NOT NULL,
      date TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `)
  const insertMem = db.prepare('INSERT INTO memories (content, category, agent_id, keywords, auto_generated, created_at) VALUES (?, ?, ?, ?, ?, ?)')
  insertMem.run('alpha', 'hot', 'agent-x', 'k1, k2', 1, 1700000000)
  insertMem.run('bravo', 'warm', 'agent-x', null, 0, 1700000100)
  insertMem.run('charlie', 'cold', 'agent-y', 'archive', 1, 1700000200)
  insertMem.run('delta', 'shared', 'agent-y', null, 0, 1700000300)
  const insertDl = db.prepare('INSERT INTO daily_logs (agent_id, date, content, created_at) VALUES (?, ?, ?, ?)')
  insertDl.run('agent-x', '2026-04-25', 'log1', 1700000400)
  insertDl.run('agent-x', '2026-04-26', 'log2', 1700000500)
  return { db, path: dbPath, dir }
}

const baseArgs = {
  ragUrl: 'http://test',
  ragToken: 'tok',
  agent: null,
  skipCold: false,
  skipMemories: false,
  skipDailyLog: false,
}

describe('migrate-memories-to-rag', () => {
  let seeded: ReturnType<typeof seedDb>

  beforeAll(() => {
    seeded = seedDb()
  })

  afterAll(() => {
    seeded.db.close()
    rmSync(seeded.dir, { recursive: true, force: true })
  })

  it('dry-run reports counts without calling client', async () => {
    const client = new FakeMigratorClient()
    const result = await runMigration(seeded.db, client, { ...baseArgs, dryRun: true }, () => {})
    expect(result.memories.scanned).toBe(4)
    expect(result.memories.migrated).toBe(4)
    expect(result.memories.byTier).toEqual({ hot: 1, warm: 1, cold: 1, shared: 1 })
    expect(result.dailyLog.scanned).toBe(2)
    expect(result.dailyLog.migrated).toBe(2)
    expect(client.postedMemories).toHaveLength(0)
    expect(client.postedDailyLogs).toHaveLength(0)
  })

  it('execute mode stages cold rows in warm tier and flags isCold', async () => {
    const client = new FakeMigratorClient()
    const result = await runMigration(seeded.db, client, { ...baseArgs, dryRun: false }, () => {})
    expect(result.memories.migrated).toBe(4)
    expect(result.memories.failed).toBe(0)
    const cold = client.postedMemories.filter(p => p.isCold)
    expect(cold).toHaveLength(1)
    expect(cold[0].payload.tier).toBe('warm')  // staged tier, not 'cold'
    const warm = client.postedMemories.find(p => !p.isCold && p.payload.tier === 'warm')
    expect(warm).toBeDefined()
    // auto_generated lives in metadata, not at top level.
    for (const p of client.postedMemories) {
      expect(typeof p.payload.metadata.migration_hash).toBe('string')
      expect(p.payload.metadata.legacy_sqlite_id).toBeTypeOf('number')
    }
    const alpha = client.postedMemories.find(p => p.payload.content === 'alpha')!
    expect(alpha.payload.metadata.auto_generated).toBe(true)
    const bravo = client.postedMemories.find(p => p.payload.content === 'bravo')!
    expect(bravo.payload.metadata.auto_generated).toBeUndefined()  // not auto -> field omitted
  })

  it('daily-log payload uses `day` (not `date`) and omits metadata', async () => {
    const client = new FakeMigratorClient()
    await runMigration(seeded.db, client, { ...baseArgs, dryRun: false }, () => {})
    expect(client.postedDailyLogs).toHaveLength(2)
    for (const p of client.postedDailyLogs) {
      expect(typeof p.day).toBe('string')
      expect((p as unknown as Record<string, unknown>).date).toBeUndefined()
      expect((p as unknown as Record<string, unknown>).metadata).toBeUndefined()
    }
  })

  it('is idempotent on second run via hash dedupe', async () => {
    const client = new FakeMigratorClient()
    await runMigration(seeded.db, client, { ...baseArgs, dryRun: false }, () => {})
    const firstCount = client.postedMemories.length
    await runMigration(seeded.db, client, { ...baseArgs, dryRun: false }, () => {})
    expect(client.postedMemories.length).toBe(firstCount)
  })

  it('--skip-cold leaves cold rows in sqlite', async () => {
    const client = new FakeMigratorClient()
    const result = await runMigration(seeded.db, client, { ...baseArgs, dryRun: false, skipCold: true }, () => {})
    expect(result.memories.migrated).toBe(3)
    expect(result.memories.skipped).toBe(1)
    expect(client.postedMemories.every(p => !p.isCold)).toBe(true)
  })

  it('--agent filter narrows the scan', async () => {
    const client = new FakeMigratorClient()
    const result = await runMigration(seeded.db, client, { ...baseArgs, dryRun: false, agent: 'agent-y' }, () => {})
    expect(result.memories.scanned).toBe(2)
    for (const p of client.postedMemories) {
      expect(p.payload.agent_id).toBe('agent-y')
    }
  })

  it('records failures without aborting the run', async () => {
    const client = new FakeMigratorClient()
    client.failures = { kind: 'memory', afterCount: 2 }
    const result = await runMigration(seeded.db, client, { ...baseArgs, dryRun: false }, () => {})
    expect(result.memories.failed).toBeGreaterThan(0)
    expect(result.memories.scanned).toBe(4)
  })
})
