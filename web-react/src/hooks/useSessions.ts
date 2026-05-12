import { useQuery } from '@tanstack/react-query'
import { apiJson } from '@/lib/api'
import type { SessionsResponse } from '@/types/api'

// Poll interval matches Marveen's spec for the live Sessions view: 3 mp.
// TanStack Query keeps the previous data in `data` while refetching, so
// rerenders are seamless and timers don't flash.
const REFETCH_MS = 3000

export function useSessions() {
  return useQuery<SessionsResponse>({
    queryKey: ['sessions'],
    queryFn: () => apiJson<SessionsResponse>('/api/sessions'),
    refetchInterval: REFETCH_MS,
    refetchIntervalInBackground: false,
  })
}
