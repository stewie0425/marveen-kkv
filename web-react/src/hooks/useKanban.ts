import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { apiFetch, apiJson } from '@/lib/api'
import type {
  Assignee,
  KanbanCard,
  KanbanComment,
  KanbanStatus,
} from '@/types/api'

const CARDS_KEY = ['kanban'] as const
const ASSIGNEES_KEY = ['kanban-assignees'] as const

export function useKanbanCards() {
  return useQuery<KanbanCard[]>({
    queryKey: CARDS_KEY,
    queryFn: () => apiJson<KanbanCard[]>('/api/kanban'),
    staleTime: 5_000,
  })
}

export function useKanbanAssignees() {
  return useQuery<Assignee[]>({
    queryKey: ASSIGNEES_KEY,
    queryFn: () => apiJson<Assignee[]>('/api/kanban/assignees'),
    staleTime: 60_000,
  })
}

export function useKanbanComments(cardId: string | number | null) {
  return useQuery<KanbanComment[]>({
    queryKey: ['kanban-comments', cardId],
    queryFn: () =>
      apiJson<KanbanComment[]>(
        `/api/kanban/${encodeURIComponent(String(cardId))}/comments`,
      ),
    enabled: cardId != null,
    staleTime: 5_000,
  })
}

interface CardInput {
  title: string
  description: string | null
  status?: KanbanStatus
  priority: 'low' | 'normal' | 'high' | 'urgent'
  assignee: string | null
  due_date: number | null
}

export function useCreateKanbanCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CardInput) => {
      const res = await apiFetch('/api/kanban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CARDS_KEY }),
  })
}

export function useUpdateKanbanCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string | number
      patch: Partial<CardInput>
    }) => {
      const res = await apiFetch(
        `/api/kanban/${encodeURIComponent(String(id))}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        },
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CARDS_KEY }),
  })
}

export function useMoveKanbanCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      status,
      sort_order,
    }: {
      id: string | number
      status: KanbanStatus
      sort_order: number
    }) => {
      const res = await apiFetch(
        `/api/kanban/${encodeURIComponent(String(id))}/move`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status, sort_order }),
        },
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    },
    // Optimistic: snapshot, write the patched cache, on error rollback,
    // and on settle invalidate so we converge to authoritative state.
    onMutate: async ({ id, status, sort_order }) => {
      await qc.cancelQueries({ queryKey: CARDS_KEY })
      const prev = qc.getQueryData<KanbanCard[]>(CARDS_KEY)
      if (prev) {
        const next = prev.map((c) =>
          c.id === id ? { ...c, status, sort_order } : c,
        )
        qc.setQueryData(CARDS_KEY, next)
      }
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(CARDS_KEY, ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: CARDS_KEY }),
  })
}

export function useArchiveKanbanCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string | number) => {
      const res = await apiFetch(
        `/api/kanban/${encodeURIComponent(String(id))}/archive`,
        { method: 'POST' },
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json().catch(() => ({}))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CARDS_KEY }),
  })
}

export function useDeleteKanbanCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string | number) => {
      const res = await apiFetch(
        `/api/kanban/${encodeURIComponent(String(id))}`,
        { method: 'DELETE' },
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json().catch(() => ({}))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CARDS_KEY }),
  })
}

export function useAddKanbanComment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      cardId,
      author,
      content,
    }: {
      cardId: string | number
      author: string
      content: string
    }) => {
      const res = await apiFetch(
        `/api/kanban/${encodeURIComponent(String(cardId))}/comments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author, content }),
        },
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    },
    onSuccess: (_data, { cardId }) =>
      qc.invalidateQueries({ queryKey: ['kanban-comments', cardId] }),
  })
}
