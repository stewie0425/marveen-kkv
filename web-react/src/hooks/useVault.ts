import { useQuery } from '@tanstack/react-query'
import { apiFetch, apiJson } from '@/lib/api'
import type {
  VaultDocument,
  VaultDocumentDetail,
  VaultListResponse,
} from '@/types/api'

interface VaultListParams {
  agent?: string
  q?: string
  limit?: number
  offset?: number
}

function buildVaultUrl(p: VaultListParams): string {
  const usp = new URLSearchParams()
  if (p.agent) usp.set('agent', p.agent)
  if (p.q) usp.set('q', p.q)
  if (p.limit) usp.set('limit', String(p.limit))
  if (p.offset) usp.set('offset', String(p.offset))
  const s = usp.toString()
  return s ? `/api/vault/documents?${s}` : '/api/vault/documents'
}

// While Steve's backend route is in flight, the endpoint may be missing.
// We treat 404 as "not yet wired" and resolve to an empty list so the page
// can render a calm empty state instead of a loud error.
async function fetchVaultList(url: string): Promise<VaultListResponse> {
  const res = await apiFetch(url)
  if (res.status === 404) {
    return { documents: [], total: 0, limit: 0, offset: 0 }
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}${text ? ': ' + text.slice(0, 200) : ''}`)
  }
  const data = (await res.json()) as VaultListResponse | VaultDocument[]
  if (Array.isArray(data)) {
    return { documents: data, total: data.length, limit: data.length, offset: 0 }
  }
  return data
}

export function useVaultDocuments(p: VaultListParams) {
  return useQuery<VaultListResponse>({
    queryKey: ['vault', 'documents', p],
    queryFn: () => fetchVaultList(buildVaultUrl(p)),
    staleTime: 10_000,
  })
}

export function useVaultDocument(id: string | null) {
  return useQuery<VaultDocumentDetail>({
    queryKey: ['vault', 'document', id],
    queryFn: () =>
      apiJson<VaultDocumentDetail>(
        `/api/vault/documents/${encodeURIComponent(String(id))}`,
      ),
    enabled: id !== null && id !== '',
    staleTime: 30_000,
  })
}
