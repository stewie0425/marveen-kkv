import { useQuery } from '@tanstack/react-query'
import { apiFetch, apiJson } from '@/lib/api'
import type {
  ObsidianTreeResponse,
  ObsidianFileResponse,
  ObsidianSearchResponse,
} from '@/types/api'

export function useObsidianTree() {
  return useQuery<ObsidianTreeResponse>({
    queryKey: ['obsidian', 'tree'],
    queryFn: () => apiJson<ObsidianTreeResponse>('/api/obsidian/tree'),
    staleTime: 30_000,
    retry: false,
  })
}

export function useObsidianFile(path: string | null) {
  return useQuery<ObsidianFileResponse>({
    queryKey: ['obsidian', 'file', path],
    queryFn: async () => {
      const res = await apiFetch(
        `/api/obsidian/file?path=${encodeURIComponent(String(path))}`,
      )
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`HTTP ${res.status}${text ? ': ' + text.slice(0, 200) : ''}`)
      }
      return res.json() as Promise<ObsidianFileResponse>
    },
    enabled: path !== null && path !== '',
    staleTime: 15_000,
  })
}

export function useObsidianSearch(q: string) {
  return useQuery<ObsidianSearchResponse>({
    queryKey: ['obsidian', 'search', q],
    queryFn: () =>
      apiJson<ObsidianSearchResponse>(
        `/api/obsidian/search?q=${encodeURIComponent(q)}`,
      ),
    enabled: q.trim().length >= 2,
    staleTime: 10_000,
  })
}
