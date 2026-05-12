import { useQuery } from '@tanstack/react-query'
import { apiJson } from '@/lib/api'
import type { OverviewResponse } from '@/types/api'

// 30 mp refetch a háttérben: az overview olvasott (counts, activity tail),
// a backend olcsó. Hosszabb intervall fölöslegesen idézőt mutatna.
export function useOverview() {
  return useQuery<OverviewResponse>({
    queryKey: ['overview'],
    queryFn: () => apiJson<OverviewResponse>('/api/overview'),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  })
}
