import { describe, it, expect, beforeEach } from 'vitest'
import { RagMemoryBackend } from '../rag.js'

interface CallLog {
  url: string
  method: string
  body: unknown | undefined
  headers: Record<string, string>
}

function memRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'uuid-1',
    agent_id: 'agent-x',
    content: 'hello',
    tier: 'warm',
    category: null,
    keywords: ['kw1', 'kw2'],
    metadata: {},
    expires_at: null,
    created_at: '2026-04-26T10:00:00Z',
    updated_at: '2026-04-26T11:00:00Z',
    ...overrides,
  }
}

function listOf(items: unknown[], key: 'memories' | 'entries' | 'documents' = 'memories'): Record<string, unknown> {
  return { total: items.length, limit: 50, offset: 0, [key]: items }
}

function makeFetchMock(responses: Array<{ status?: number; body?: unknown; bodyText?: string; contentType?: string }>): {
  fetch: typeof fetch
  calls: CallLog[]
} {
  const calls: CallLog[] = []
  let i = 0
  const fakeFetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString()
    const headers = (init?.headers ?? {}) as Record<string, string>
    let body: unknown = undefined
    if (init?.body !== undefined && init.body !== null) {
      try { body = JSON.parse(init.body as string) } catch { body = init.body }
    }
    calls.push({ url, method: init?.method ?? 'GET', body, headers })
    const resp = responses[i++] ?? { status: 200, body: {} }
    const status = resp.status ?? 200
    const ctype = resp.contentType ?? (resp.body !== undefined ? 'application/json' : 'text/plain')
    const noBody = status === 204 || status === 205 || status === 304
    const payload = noBody ? null : (resp.body !== undefined ? JSON.stringify(resp.body) : (resp.bodyText ?? ''))
    return new Response(payload, { status, headers: { 'content-type': ctype } })
  }
  return { fetch: fakeFetch as unknown as typeof fetch, calls }
}

describe('RagMemoryBackend', () => {
  let _calls: CallLog[]
  beforeEach(() => { _calls = [] })

  it('saveMemory routes hot to /memory and packs auto_generated into metadata', async () => {
    const mock = makeFetchMock([{ body: memRow({ id: 'uuid-hot', tier: 'hot' }) }])
    const backend = new RagMemoryBackend('http://rag.test', 'tok', mock.fetch)
    const r = await backend.saveMemory({ agent_id: 'a', content: 'hi', category: 'hot', keywords: 'x, y', auto_generated: true })
    expect(r.id).toBe('uuid-hot')
    expect(mock.calls).toHaveLength(1)
    expect(mock.calls[0].url).toBe('http://rag.test/memory')
    expect(mock.calls[0].method).toBe('POST')
    expect(mock.calls[0].headers.Authorization).toBe('Bearer tok')
    const body = mock.calls[0].body as Record<string, unknown>
    expect(body.tier).toBe('hot')
    expect(body.keywords).toEqual(['x', 'y'])
    expect((body.metadata as Record<string, unknown>).auto_generated).toBe(true)
    // auto_generated must NOT be a top-level field on MemoryCreate.
    expect('auto_generated' in body).toBe(false)
  })

  it('saveMemory cold does create-then-promote and returns document_id', async () => {
    const created = memRow({ id: 'uuid-staging', tier: 'warm' })
    const promote = { id: 'uuid-staging', to_tier: 'cold', document_id: 'doc-cold-1', vault_path: '/vault/x.md', chunks: 2, git_commit: 'abc', deleted_memory: true }
    const mock = makeFetchMock([{ body: created }, { body: promote }])
    const backend = new RagMemoryBackend('http://rag.test', 'tok', mock.fetch)
    const r = await backend.saveMemory({ agent_id: 'a', content: 'archive me', category: 'cold' })
    expect(r.id).toBe('doc-cold-1')
    expect(mock.calls).toHaveLength(2)
    expect(mock.calls[0].url).toBe('http://rag.test/memory')
    expect((mock.calls[0].body as Record<string, unknown>).tier).toBe('warm')
    expect(mock.calls[1].url).toBe('http://rag.test/memory/promote')
    expect(mock.calls[1].body).toEqual({ id: 'uuid-staging', to_tier: 'cold', write_vault: true, git_commit: true })
  })

  it('searchMemories unwraps the memories pagination wrapper', async () => {
    const mock = makeFetchMock([{ body: listOf([memRow({ id: 'r1' }), memRow({ id: 'r2' })]) }])
    const backend = new RagMemoryBackend('http://rag.test', 'tok', mock.fetch)
    const out = await backend.searchMemories('agent-x', 'hi', 5, 'fts')
    expect(out).toHaveLength(2)
    expect(out.map(o => o.id)).toEqual(['r1', 'r2'])
    expect(mock.calls[0].url).toContain('/memory?')
    expect(mock.calls[0].url).toContain('q=hi')
    expect(mock.calls[0].url).toContain('agent_id=agent-x')
  })

  it('searchMemories hybrid mode currently degrades to /memory?q= (documented)', async () => {
    const mock = makeFetchMock([{ body: listOf([]) }])
    const backend = new RagMemoryBackend('http://rag.test', 'tok', mock.fetch)
    await backend.searchMemories('agent-x', 'hi', 5, 'hybrid')
    expect(mock.calls[0].url).toContain('/memory?')
    expect(mock.calls[0].url).not.toContain('/search')
  })

  it('toDashboard maps tier->category, recovers auto_generated, falls back to created_at', async () => {
    const mock = makeFetchMock([{ body: listOf([memRow({
      id: 'uuid-mapping',
      tier: 'shared',
      keywords: ['a', 'b', 'c'],
      metadata: { auto_generated: true, other: 1 },
      updated_at: null,
    })]) }])
    const backend = new RagMemoryBackend('http://rag.test', 'tok', mock.fetch)
    const out = await backend.getMemoriesForAgent('agent-x', 5)
    expect(out[0].id).toBe('uuid-mapping')
    expect(out[0].category).toBe('shared')
    expect(out[0].keywords).toBe('a, b, c')
    expect(out[0].auto_generated).toBe(1)
    const created = Math.floor(Date.parse('2026-04-26T10:00:00Z') / 1000)
    expect(out[0].created_at).toBe(created)
    expect(out[0].accessed_at).toBe(created)  // no updated_at, falls back
  })

  it('updateMemory PATCHes without agent_id and rejects on 404', async () => {
    const mock = makeFetchMock([
      { status: 200, body: memRow() },
      { status: 404, bodyText: 'not found' },
    ])
    const backend = new RagMemoryBackend('http://rag.test', 'tok', mock.fetch)
    expect(await backend.updateMemory('uuid-1', { content: 'new', category: 'shared', agent_id: 'should-be-ignored', keywords: 'x' })).toBe(true)
    expect(await backend.updateMemory('uuid-2', { content: 'x' })).toBe(false)
    const patchBody = mock.calls[0].body as Record<string, unknown>
    expect(mock.calls[0].method).toBe('PATCH')
    expect(patchBody.tier).toBe('shared')
    expect(patchBody.content).toBe('new')
    expect(patchBody.keywords).toEqual(['x'])
    // RAG MemoryUpdate has no agent_id field; we silently drop it.
    expect('agent_id' in patchBody).toBe(false)
  })

  it('deleteMemory returns false on 404', async () => {
    const mock = makeFetchMock([{ status: 404, bodyText: 'gone' }])
    const backend = new RagMemoryBackend('http://rag.test', 'tok', mock.fetch)
    expect(await backend.deleteMemory('nope')).toBe(false)
  })

  it('getStats derives byAgent/byTier from /memory listing', async () => {
    const rows = [
      memRow({ id: '1', agent_id: 'a', tier: 'hot' }),
      memRow({ id: '2', agent_id: 'a', tier: 'warm' }),
      memRow({ id: '3', agent_id: 'b', tier: 'warm' }),
    ]
    const mock = makeFetchMock([{ body: listOf(rows) }])
    const backend = new RagMemoryBackend('http://rag.test', 'tok', mock.fetch)
    const stats = await backend.getStats()
    expect(stats.total).toBe(3)
    expect(stats.byAgent).toEqual({ a: 2, b: 1 })
    expect(stats.byTier).toEqual({ hot: 1, warm: 2 })
    expect(stats.withEmbedding).toBe(0)
  })

  it('appendDailyLog posts to /daily-log without day field', async () => {
    const mock = makeFetchMock([{ status: 200, body: { id: 'd1', agent_id: 'a', day: '2026-04-26', content: 'x', created_at: '2026-04-26T10:00:00Z' } }])
    const backend = new RagMemoryBackend('http://rag.test', 'tok', mock.fetch)
    await backend.appendDailyLog('agent-x', 'hello')
    expect(mock.calls[0].url).toBe('http://rag.test/daily-log')
    expect(mock.calls[0].method).toBe('POST')
    expect(mock.calls[0].body).toEqual({ agent_id: 'agent-x', content: 'hello' })
  })

  it('getDailyLog uses from/to ISO bounds and unwraps entries', async () => {
    const mock = makeFetchMock([{ body: listOf([
      { id: 'd1', agent_id: 'a', day: '2026-04-26', content: 'a', created_at: '2026-04-26T10:00:00Z' },
      { id: 'd2', agent_id: 'a', day: '2026-04-26', content: 'b', created_at: '2026-04-26T18:00:00Z' },
    ], 'entries') }])
    const backend = new RagMemoryBackend('http://rag.test', 'tok', mock.fetch)
    const entries = await backend.getDailyLog('agent-x', '2026-04-26')
    expect(entries).toHaveLength(2)
    expect(mock.calls[0].url).toContain('from=2026-04-26T00%3A00%3A00Z')
    expect(mock.calls[0].url).toContain('to=2026-04-26T23%3A59%3A59.999Z')
  })

  it('getDailyLogDates dedupes the day field server-side', async () => {
    const mock = makeFetchMock([{ body: listOf([
      { id: '1', agent_id: 'a', day: '2026-04-26', content: 'a', created_at: '2026-04-26T10:00:00Z' },
      { id: '2', agent_id: 'a', day: '2026-04-26', content: 'b', created_at: '2026-04-26T18:00:00Z' },
      { id: '3', agent_id: 'a', day: '2026-04-25', content: 'c', created_at: '2026-04-25T10:00:00Z' },
    ], 'entries') }])
    const backend = new RagMemoryBackend('http://rag.test', 'tok', mock.fetch)
    const dates = await backend.getDailyLogDates('agent-x', 14)
    expect(dates).toEqual(['2026-04-26', '2026-04-25'])
  })

  it('non-OK response surfaces service body in error message', async () => {
    const mock = makeFetchMock([{ status: 500, bodyText: 'database is on fire' }])
    const backend = new RagMemoryBackend('http://rag.test', 'tok', mock.fetch)
    await expect(backend.saveMemory({ agent_id: 'a', content: 'x', category: 'warm' }))
      .rejects.toThrow(/database is on fire/)
  })
})
