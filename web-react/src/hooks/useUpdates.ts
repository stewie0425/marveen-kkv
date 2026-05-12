import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { apiFetch, apiJson } from '@/lib/api'
import type { UpdateStatus } from '@/types/api'

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
