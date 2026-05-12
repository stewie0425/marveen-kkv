import { useQuery } from '@tanstack/react-query'
import { apiJson } from '@/lib/api'
import type { TeamGraphResponse } from '@/types/api'

export function useTeamGraph() {
  return useQuery<TeamGraphResponse>({
    queryKey: ['team-graph'],
    queryFn: () => apiJson<TeamGraphResponse>('/api/team/graph'),
    staleTime: 30_000,
  })
}
