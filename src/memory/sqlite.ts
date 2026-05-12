// SQLite-backed memory store. Thin adapter over db.ts -- the legacy code path,
// kept as the default until marveen-rag is confirmed live.

import {
  saveAgentMemory,
  getAgentMemories,
  searchAgentMemories,
  hybridSearch,
  updateMemory as dbUpdateMemory,
  getMemoryStats,
  appendDailyLog,
  getDailyLog,
  getDailyLogDates,
  getDb,
  type Memory,
} from '../db.js'
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

function toDashboard(m: Memory): DashboardMemory {
  return {
    id: m.id,
    agent_id: m.agent_id,
    content: m.content,
    category: m.category as MemoryCategory,
    keywords: m.keywords,
    auto_generated: m.auto_generated,
    created_at: m.created_at,
    accessed_at: m.accessed_at,
    chat_id: m.chat_id,
    topic_key: m.topic_key,
    sector: m.sector,
    salience: m.salience,
    embedding: m.embedding,
  }
}

export class SqliteMemoryBackend implements MemoryBackend {
  readonly kind = 'sqlite' as const

  async saveMemory(input: SaveMemoryInput): Promise<{ id: number | string }> {
    const result = saveAgentMemory(
      input.agent_id,
      input.content,
      input.category,
      input.keywords,
      input.auto_generated ?? false,
    )
    return { id: result.id }
  }

  async getMemoriesForAgent(agentId: string, limit: number): Promise<DashboardMemory[]> {
    return getAgentMemories(agentId, limit).map(toDashboard)
  }

  async searchMemories(
    agentId: string,
    query: string,
    limit: number,
    mode: SearchMode,
  ): Promise<DashboardMemory[]> {
    if (mode === 'hybrid') {
      const results = await hybridSearch(agentId, query, limit)
      return results.map(toDashboard)
    }
    return searchAgentMemories(agentId, query, limit).map(toDashboard)
  }

  async updateMemory(id: number | string, updates: UpdateMemoryInput): Promise<boolean> {
    if (typeof id !== 'number') {
      // SQLite ids are integers; reject string ids cleanly so callers can
      // surface a 400 instead of letting a NaN run() update a row.
      return false
    }
    if (updates.content === undefined) {
      // Legacy db.updateMemory requires content (its UPDATE is unconditional
      // on that column). Refuse partial updates that don't touch content.
      return false
    }
    return dbUpdateMemory(
      id,
      updates.content,
      updates.category,
      updates.agent_id,
      updates.keywords,
    )
  }

  async deleteMemory(id: number | string): Promise<boolean> {
    if (typeof id !== 'number') return false
    const db2 = getDb()
    const changes = db2.prepare('DELETE FROM memories WHERE id = ?').run(id).changes
    return changes > 0
  }

  async getStats(): Promise<MemoryStats> {
    return getMemoryStats()
  }

  async appendDailyLog(agentId: string, content: string): Promise<void> {
    appendDailyLog(agentId, content)
  }

  async getDailyLog(agentId: string, date: string): Promise<DailyLogEntry[]> {
    return getDailyLog(agentId, date)
  }

  async getDailyLogDates(agentId: string, limit = 14): Promise<string[]> {
    return getDailyLogDates(agentId, limit)
  }
}
