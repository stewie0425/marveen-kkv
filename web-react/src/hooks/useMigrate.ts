import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import type {
  MigrateFinding,
  MigrateRunResponse,
  MigrateScanResponse,
} from '@/types/api'

export function useMigrateScan() {
  return useMutation({
    mutationFn: async ({
      sourcePath,
      sourceType,
    }: {
      sourcePath: string
      sourceType: string
    }) => {
      const res = await apiFetch('/api/migrate/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourcePath, sourceType }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok)
        throw new Error(
          (data as { error?: string }).error || `HTTP ${res.status}`,
        )
      return data as MigrateScanResponse
    },
  })
}

export function useMigrateRun() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      findings,
      agentId,
    }: {
      findings: MigrateFinding[]
      agentId: string
    }) => {
      const res = await apiFetch('/api/migrate/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ findings, agentId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok)
        throw new Error(
          (data as { error?: string }).error || `HTTP ${res.status}`,
        )
      return data as MigrateRunResponse
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['memories'] })
      qc.invalidateQueries({ queryKey: ['memories', 'stats'] })
    },
  })
}
