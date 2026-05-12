import { useQuery } from '@tanstack/react-query'
import { apiJson } from '@/lib/api'
import type { StatusResponse } from '@/types/api'

// Status-incident feed nem mozog gyorsan, refetch interval 2 perc, és
// a refresh gomb manuálisan invalidate-eli.
export function useStatus() {
  return useQuery<StatusResponse>({
    queryKey: ['status'],
    queryFn: () => apiJson<StatusResponse>('/api/status'),
    refetchInterval: 120_000,
    refetchIntervalInBackground: false,
  })
}
