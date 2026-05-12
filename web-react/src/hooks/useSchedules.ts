import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { apiFetch, apiJson } from '@/lib/api'
import type {
  PendingRetry,
  ScheduleAgent,
  ScheduleTask,
} from '@/types/api'

const SCHEDULES_KEY = ['schedules'] as const
const PENDING_KEY = ['schedules', 'pending'] as const

export function useSchedules() {
  return useQuery<ScheduleTask[]>({
    queryKey: SCHEDULES_KEY,
    queryFn: () => apiJson<ScheduleTask[]>('/api/schedules'),
    staleTime: 10_000,
  })
}

export function useScheduleAgents() {
  return useQuery<ScheduleAgent[]>({
    queryKey: ['schedules', 'agents'],
    queryFn: () => apiJson<ScheduleAgent[]>('/api/schedules/agents'),
    staleTime: 60_000,
  })
}

export function usePendingRetries() {
  return useQuery<PendingRetry[]>({
    queryKey: PENDING_KEY,
    queryFn: () => apiJson<PendingRetry[]>('/api/schedules/pending'),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    staleTime: 10_000,
  })
}

interface ScheduleInput {
  name: string
  description?: string
  prompt: string
  schedule: string
  agent: string
  type: 'task' | 'heartbeat'
}

export function useCreateSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: ScheduleInput) => {
      const res = await apiFetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) {
        const t = await res.text().catch(() => '')
        throw new Error(`HTTP ${res.status}${t ? ': ' + t : ''}`)
      }
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: SCHEDULES_KEY }),
  })
}

export function useUpdateSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      name,
      patch,
    }: {
      name: string
      patch: Partial<ScheduleInput>
    }) => {
      const res = await apiFetch(
        `/api/schedules/${encodeURIComponent(name)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        },
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: SCHEDULES_KEY }),
  })
}

export function useToggleSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      const res = await apiFetch(
        `/api/schedules/${encodeURIComponent(name)}/toggle`,
        { method: 'POST' },
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json().catch(() => ({}))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: SCHEDULES_KEY }),
  })
}

export function useDeleteSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      const res = await apiFetch(
        `/api/schedules/${encodeURIComponent(name)}`,
        { method: 'DELETE' },
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json().catch(() => ({}))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: SCHEDULES_KEY }),
  })
}

export function useCancelPendingRetry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(
        `/api/schedules/pending/${encodeURIComponent(id)}`,
        { method: 'DELETE' },
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json().catch(() => ({}))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PENDING_KEY }),
  })
}
