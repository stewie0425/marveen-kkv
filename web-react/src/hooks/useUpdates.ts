import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { apiFetch, apiJson } from '@/lib/api'
import type { UpdateStatus, UpstreamStatus } from '@/types/api'

const KEY = ['updates'] as const

export function useUpdates() {
  return useQuery<UpdateStatus>({
    queryKey: KEY,
    queryFn: () => apiJson<UpdateStatus>('/api/updates'),
    staleTime: 60_000,
  })
}

export function useCheckUpdate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const res = await apiFetch('/api/updates/check', { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useApplyUpdate() {
  return useMutation({
    mutationFn: async () => {
      const res = await apiFetch('/api/updates/apply', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      return data
    },
  })
}

const UPSTREAM_KEY = ['updates', 'upstream'] as const

export function useUpstreamStatus() {
  return useQuery<UpstreamStatus>({
    queryKey: UPSTREAM_KEY,
    queryFn: () => apiJson<UpstreamStatus>('/api/updates/upstream'),
    staleTime: 60_000,
  })
}

export function useSyncUpstreamRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { commits: string[] }) => {
      const res = await apiFetch('/api/updates/sync-upstream-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: UPSTREAM_KEY }),
  })
}
