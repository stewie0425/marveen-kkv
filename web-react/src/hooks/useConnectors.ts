import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { apiFetch, apiJson } from '@/lib/api'
import type { CatalogItem, Connector, ConnectorsStatus } from '@/types/api'

const CONNECTORS_KEY = ['connectors'] as const
const CATALOG_KEY = ['mcp-catalog'] as const

export function useConnectors() {
  return useQuery<Connector[]>({
    queryKey: CONNECTORS_KEY,
    queryFn: () => apiJson<Connector[]>('/api/connectors'),
    staleTime: 30_000,
  })
}

export function useConnectorsStatus() {
  return useQuery<ConnectorsStatus>({
    queryKey: ['connectors', 'status'],
    queryFn: () => apiJson<ConnectorsStatus>('/api/connectors/status'),
    staleTime: 60_000,
    retry: 0,
  })
}

export function useMcpCatalog() {
  return useQuery<CatalogItem[]>({
    queryKey: CATALOG_KEY,
    queryFn: () => apiJson<CatalogItem[]>('/api/mcp-catalog'),
    staleTime: 5 * 60_000,
  })
}

export function useRefreshConnectors() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const res = await apiFetch('/api/connectors/refresh', { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CONNECTORS_KEY }),
  })
}

export function useInstallCatalogItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, scope }: { id: string; scope?: string }) => {
      const res = await apiFetch(
        `/api/mcp-catalog/${encodeURIComponent(id)}/install`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scope: scope ?? 'user' }),
        },
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CONNECTORS_KEY })
      qc.invalidateQueries({ queryKey: CATALOG_KEY })
    },
  })
}

export function useUninstallCatalogItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(
        `/api/mcp-catalog/${encodeURIComponent(id)}/uninstall`,
        { method: 'DELETE' },
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CONNECTORS_KEY })
      qc.invalidateQueries({ queryKey: CATALOG_KEY })
    },
  })
}

export function useDeleteConnector() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      const res = await apiFetch(
        `/api/connectors/${encodeURIComponent(name)}`,
        { method: 'DELETE' },
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CONNECTORS_KEY }),
  })
}
