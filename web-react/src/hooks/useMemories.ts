import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { apiFetch, apiJson } from '@/lib/api'
import type { Memory, MemoryStats, MemoryTier } from '@/types/api'

const STATS_KEY = ['memories', 'stats'] as const

interface MemoryQueryParams {
  agent?: string
  category?: MemoryTier | ''
  q?: string
  searchMode?: 'fts' | 'hybrid'
  limit?: number
}

function buildMemoriesUrl(p: MemoryQueryParams): string {
  const usp = new URLSearchParams()
  if (p.agent) usp.set('agent', p.agent)
  if (p.category) usp.set('category', p.category)
  if (p.q) {
    usp.set('q', p.q)
    if (p.searchMode) usp.set('mode', p.searchMode)
  }
  if (p.limit) usp.set('limit', String(p.limit))
  const s = usp.toString()
  return s ? `/api/memories?${s}` : '/api/memories'
}

export function useMemories(p: MemoryQueryParams) {
  return useQuery<Memory[]>({
    queryKey: ['memories', p],
    queryFn: () => apiJson<Memory[]>(buildMemoriesUrl(p)),
    staleTime: 5_000,
  })
}

export function useMemoryStats() {
  return useQuery<MemoryStats>({
    queryKey: STATS_KEY,
    queryFn: () => apiJson<MemoryStats>('/api/memories/stats'),
    staleTime: 10_000,
  })
}

interface MemoryInput {
  agent_id: string
  content: string
  category: MemoryTier
  keywords?: string
}

export function useCreateMemory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: MemoryInput) => {
      const res = await apiFetch('/api/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['memories'] })
      qc.invalidateQueries({ queryKey: STATS_KEY })
    },
  })
}

export function useUpdateMemory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: number | string
      patch: Partial<MemoryInput>
    }) => {
      const res = await apiFetch(
        `/api/memories/${encodeURIComponent(String(id))}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        },
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['memories'] })
      qc.invalidateQueries({ queryKey: STATS_KEY })
    },
  })
}

export function useDeleteMemory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number | string) => {
      const res = await apiFetch(
        `/api/memories/${encodeURIComponent(String(id))}`,
        { method: 'DELETE' },
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json().catch(() => ({}))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['memories'] })
      qc.invalidateQueries({ queryKey: STATS_KEY })
    },
  })
}
