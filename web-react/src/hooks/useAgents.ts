import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { apiFetch, apiJson } from '@/lib/api'
import type {
  AgentDetail,
  AgentSummary,
  MarveenInfo,
  SecurityProfile,
} from '@/types/api'

const AGENTS_KEY = ['agents'] as const
const MARVEEN_KEY = ['marveen'] as const

export function useAgents() {
  return useQuery<AgentSummary[]>({
    queryKey: AGENTS_KEY,
    queryFn: () => apiJson<AgentSummary[]>('/api/agents'),
    staleTime: 10_000,
  })
}

export function useMarveen() {
  return useQuery<MarveenInfo>({
    queryKey: MARVEEN_KEY,
    queryFn: () => apiJson<MarveenInfo>('/api/marveen'),
    staleTime: 30_000,
  })
}

export function useAgentDetail(name: string | null) {
  return useQuery<AgentDetail>({
    queryKey: ['agent', name],
    queryFn: () => apiJson<AgentDetail>(`/api/agents/${encodeURIComponent(name!)}`),
    enabled: !!name,
    staleTime: 10_000,
  })
}

export function useSecurityProfiles() {
  return useQuery<SecurityProfile[]>({
    queryKey: ['profiles'],
    queryFn: () => apiJson<SecurityProfile[]>('/api/profiles'),
    staleTime: 5 * 60_000,
  })
}

interface CreateAgentInput {
  name: string
  description: string
  model: string
  profile: string
}

export function useCreateAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateAgentInput) => {
      const res = await apiFetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) {
        const err = await res.text().catch(() => '')
        throw new Error(`HTTP ${res.status}${err ? ': ' + err : ''}`)
      }
      return (await res.json()) as { name: string }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: AGENTS_KEY })
    },
  })
}

interface UpdateAgentInput {
  name: string
  patch: Partial<{
    displayName: string
    description: string
    model: string
    claudeMd: string
    soulMd: string
    mcpJson: string
  }>
}

export function useUpdateAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, patch }: UpdateAgentInput) => {
      const res = await apiFetch(`/api/agents/${encodeURIComponent(name)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    },
    onSuccess: (_data, { name }) => {
      qc.invalidateQueries({ queryKey: AGENTS_KEY })
      qc.invalidateQueries({ queryKey: ['agent', name] })
    },
  })
}

export function useDeleteAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      const res = await apiFetch(`/api/agents/${encodeURIComponent(name)}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json().catch(() => ({}))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: AGENTS_KEY })
    },
  })
}

type ProcessAction = 'start' | 'stop'

export function useAgentProcess() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      name,
      action,
    }: {
      name: string
      action: ProcessAction
    }) => {
      const res = await apiFetch(
        `/api/agents/${encodeURIComponent(name)}/${action}`,
        { method: 'POST' },
      )
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`HTTP ${res.status}${text ? ': ' + text : ''}`)
      }
      return res.json().catch(() => ({}))
    },
    onSuccess: (_data, { name }) => {
      qc.invalidateQueries({ queryKey: AGENTS_KEY })
      qc.invalidateQueries({ queryKey: ['agent', name] })
      qc.invalidateQueries({ queryKey: ['sessions'] })
    },
  })
}

export function useUploadAvatar() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, file }: { name: string; file: File }) => {
      const fd = new FormData()
      fd.append('avatar', file)
      const res = await apiFetch(
        `/api/agents/${encodeURIComponent(name)}/avatar`,
        { method: 'POST', body: fd },
      )
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`HTTP ${res.status}${text ? ': ' + text : ''}`)
      }
      return res.json().catch(() => ({}))
    },
    onSuccess: (_data, { name }) => {
      qc.invalidateQueries({ queryKey: AGENTS_KEY })
      qc.invalidateQueries({ queryKey: ['agent', name] })
      qc.invalidateQueries({ queryKey: ['sessions'] })
      qc.invalidateQueries({ queryKey: ['team-graph'] })
    },
  })
}

// Pick one of the prebuilt /avatars/*.png images. The same backend
// endpoint handles both multipart upload and this JSON-body variant.
export function useSelectGalleryAvatar() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      name,
      galleryAvatar,
    }: {
      name: string
      galleryAvatar: string
    }) => {
      const res = await apiFetch(
        `/api/agents/${encodeURIComponent(name)}/avatar`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ galleryAvatar }),
        },
      )
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`HTTP ${res.status}${text ? ': ' + text : ''}`)
      }
      return res.json().catch(() => ({}))
    },
    onSuccess: (_data, { name }) => {
      qc.invalidateQueries({ queryKey: AGENTS_KEY })
      qc.invalidateQueries({ queryKey: ['agent', name] })
      qc.invalidateQueries({ queryKey: ['sessions'] })
      qc.invalidateQueries({ queryKey: ['team-graph'] })
    },
  })
}

export function useUpdateTeam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      name,
      team,
    }: {
      name: string
      team: {
        role: 'leader' | 'member'
        reportsTo: string | null
        delegatesTo: string[]
        autoDelegation: boolean
        trustFrom: string[]
      }
    }) => {
      const res = await apiFetch(`/api/agents/${encodeURIComponent(name)}/team`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(team),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    },
    onSuccess: (_data, { name }) => {
      qc.invalidateQueries({ queryKey: AGENTS_KEY })
      qc.invalidateQueries({ queryKey: ['agent', name] })
      qc.invalidateQueries({ queryKey: ['team-graph'] })
    },
  })
}

export function useUpdateSecurityProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, profile }: { name: string; profile: string }) => {
      const res = await apiFetch(`/api/agents/${encodeURIComponent(name)}/security`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    },
    onSuccess: (_data, { name }) => {
      qc.invalidateQueries({ queryKey: AGENTS_KEY })
      qc.invalidateQueries({ queryKey: ['agent', name] })
    },
  })
}

export interface TelegramPendingEntry {
  code: string
  senderId: string
  chatId: string
  createdAt: string
  expiresAt: string
}

export function useTelegramPending(name: string | null, enabled: boolean) {
  return useQuery<TelegramPendingEntry[]>({
    queryKey: ['agent-tg-pending', name],
    queryFn: () => apiJson<TelegramPendingEntry[]>(`/api/agents/${encodeURIComponent(name!)}/telegram/pending`),
    enabled: !!name && enabled,
    refetchInterval: 15_000,
  })
}

export function useTelegramConnect() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, botToken }: { name: string; botToken: string }) => {
      const res = await apiFetch(`/api/agents/${encodeURIComponent(name)}/telegram`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      return res.json()
    },
    onSuccess: (_data, { name }) => {
      qc.invalidateQueries({ queryKey: AGENTS_KEY })
      qc.invalidateQueries({ queryKey: ['agent', name] })
    },
  })
}

export function useTelegramDisconnect() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      const res = await apiFetch(`/api/agents/${encodeURIComponent(name)}/telegram`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json().catch(() => ({}))
    },
    onSuccess: (_data, name) => {
      qc.invalidateQueries({ queryKey: AGENTS_KEY })
      qc.invalidateQueries({ queryKey: ['agent', name] })
    },
  })
}

export function useTelegramTest() {
  return useMutation({
    mutationFn: async (name: string) => {
      const res = await apiFetch(`/api/agents/${encodeURIComponent(name)}/telegram/test`, { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json().catch(() => ({}))
    },
  })
}

export function useTelegramApprove() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, code }: { name: string; code: string }) => {
      const res = await apiFetch(`/api/agents/${encodeURIComponent(name)}/telegram/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      return res.json()
    },
    onSuccess: (_data, { name }) => {
      qc.invalidateQueries({ queryKey: ['agent-tg-pending', name] })
    },
  })
}
