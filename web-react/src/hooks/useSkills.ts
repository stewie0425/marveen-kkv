import { useQuery } from '@tanstack/react-query'
import { apiJson } from '@/lib/api'
import type { Skill } from '@/types/api'

export function useSkills() {
  return useQuery<Skill[]>({
    queryKey: ['skills'],
    queryFn: () => apiJson<Skill[]>('/api/skills'),
    staleTime: 30_000,
  })
}
