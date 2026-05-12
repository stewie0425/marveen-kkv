// Memory backend abstraction.
//
// Two implementations: an in-process SQLite store (current default) and an
// HTTP client to the marveen-rag service. Web handlers call this interface
// instead of touching db.ts directly, so the storage layer can be swapped
// behind the MARVEEN_MEMORY_BACKEND flag without churning route code.
//
// Tier routing (RAG impl): hot/warm/shared go to the live store; cold goes
// through /memory/promote which writes the canonical copy into the Obsidian
// vault and indexes it back into the RAG corpus.

export type MemoryCategory = 'hot' | 'warm' | 'cold' | 'shared'
export const MEMORY_CATEGORIES = new Set<MemoryCategory>(['hot', 'warm', 'cold', 'shared'])

// Shape returned to the dashboard frontend. Mirrors the existing SQLite Memory
// row with `id` widened to support RAG's UUIDs. Fields the frontend doesn't
// use are optional so the RAG backend doesn't have to fabricate them.
export interface DashboardMemory {
  id: number | string
  agent_id: string
  content: string
  category: MemoryCategory
  keywords: string | null
  auto_generated: number
  created_at: number
  accessed_at: number
  chat_id?: string
  topic_key?: string | null
  sector?: 'semantic' | 'episodic'
  salience?: number
  embedding?: string | null
}

export interface SaveMemoryInput {
  agent_id: string
  content: string
  category: MemoryCategory
  keywords?: string
  auto_generated?: boolean
  metadata?: Record<string, unknown>
}

export interface UpdateMemoryInput {
  content?: string
  category?: MemoryCategory
  agent_id?: string
  keywords?: string
}

export interface MemoryStats {
  total: number
  byAgent: Record<string, number>
  byTier: Record<string, number>
  withEmbedding: number
}

export interface DailyLogEntry {
  id: number | string
  content: string
  created_at: number
}

export type SearchMode = 'fts' | 'hybrid'

export interface MemoryBackend {
  readonly kind: 'sqlite' | 'rag'

  saveMemory(input: SaveMemoryInput): Promise<{ id: number | string }>
  getMemoriesForAgent(agentId: string, limit: number): Promise<DashboardMemory[]>
  searchMemories(
    agentId: string,
    query: string,
    limit: number,
    mode: SearchMode,
  ): Promise<DashboardMemory[]>
  updateMemory(id: number | string, updates: UpdateMemoryInput): Promise<boolean>
  deleteMemory(id: number | string): Promise<boolean>
  getStats(): Promise<MemoryStats>

  appendDailyLog(agentId: string, content: string): Promise<void>
  getDailyLog(agentId: string, date: string): Promise<DailyLogEntry[]>
  getDailyLogDates(agentId: string, limit?: number): Promise<string[]>
}

let cached: MemoryBackend | null = null

// Lazy factory. Importing this module must NOT initialize the SQLite database
// (db.ts initDatabase() runs separately at boot). The selected backend is
// constructed on first use to make tests that swap MARVEEN_MEMORY_BACKEND at
// runtime work without re-importing.
export async function getMemoryBackend(): Promise<MemoryBackend> {
  if (cached) return cached
  const { MEMORY_BACKEND, RAG_URL, RAG_TOKEN } = await import('../config.js')
  if (MEMORY_BACKEND === 'rag') {
    if (!RAG_TOKEN) {
      throw new Error('MARVEEN_MEMORY_BACKEND=rag requires MARVEEN_RAG_TOKEN to be set')
    }
    const { RagMemoryBackend } = await import('./rag.js')
    cached = new RagMemoryBackend(RAG_URL, RAG_TOKEN)
    return cached
  }
  const { SqliteMemoryBackend } = await import('./sqlite.js')
  cached = new SqliteMemoryBackend()
  return cached
}

// Test helper: discard the cached backend so a fresh selection happens on the
// next getMemoryBackend() call. Production code never invokes this.
export function resetMemoryBackendForTests(replacement?: MemoryBackend): void {
  cached = replacement ?? null
}
