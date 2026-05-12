import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { apiFetch, apiJson } from '@/lib/api'
import type { DailyLogEntry } from '@/types/api'

export function useDailyLogDates(agent: string | null) {
  return useQuery<string[]>({
    queryKey: ['daily-log', 'dates', agent],
    queryFn: () =>
      apiJson<string[]>(
        `/api/daily-log/dates?agent=${encodeURIComponent(agent!)}`,
      ),
    enabled: !!agent,
    staleTime: 30_000,
  })
}

export function useDailyLogEntries(agent: string | null, date: string) {
  return useQuery<DailyLogEntry[]>({
    queryKey: ['daily-log', 'entries', agent, date],
    queryFn: () =>
      apiJson<DailyLogEntry[]>(
        `/api/daily-log?agent=${encodeURIComponent(agent!)}&date=${encodeURIComponent(date)}`,
      ),
    enabled: !!agent,
    staleTime: 5_000,
  })
}

interface AddEntryInput {
  agent_id: string
  content: string
}

export function useAddDailyLog() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: AddEntryInput) => {
      const res = await apiFetch('/api/daily-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    },
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: ['daily-log', 'entries', input.agent_id] })
      qc.invalidateQueries({ queryKey: ['daily-log', 'dates', input.agent_id] })
    },
  })
}
