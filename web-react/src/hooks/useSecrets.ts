import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch, apiJson } from '@/lib/api'
import type {
  SecretListItem,
  SecretWriteRequest,
  SecretWriteResponse,
} from '@/types/api'

const SECRETS_KEY = ['secrets'] as const

// While Steve's backend route is in flight on a fresh dashboard, the
// endpoint may briefly be missing. Treat 404 as "registry empty" so the
// page renders a calm empty state instead of a loud error.
async function fetchSecretList(): Promise<SecretListItem[]> {
  const res = await apiFetch('/api/secrets')
  if (res.status === 404) return []
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}${text ? ': ' + text.slice(0, 200) : ''}`)
  }
  const data = (await res.json()) as SecretListItem[]
  return Array.isArray(data) ? data : []
}

export function useSecretList() {
  return useQuery<SecretListItem[]>({
    queryKey: SECRETS_KEY,
    queryFn: fetchSecretList,
    staleTime: 5_000,
  })
}

export function useAddSecret() {
  const qc = useQueryClient()
  return useMutation<SecretWriteResponse, Error, SecretWriteRequest>({
    mutationFn: (body) =>
      apiJson<SecretWriteResponse>('/api/secrets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: SECRETS_KEY }),
  })
}

export function useDeleteSecret() {
  const qc = useQueryClient()
  return useMutation<{ ok: boolean }, Error, string>({
    mutationFn: (name) =>
      apiJson<{ ok: boolean }>(
        `/api/secrets/${encodeURIComponent(name)}`,
        { method: 'DELETE' },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: SECRETS_KEY }),
  })
}
