import { useEffect, useState } from 'react'
import { Modal } from '@/components/common/Modal'
import { Button } from '@/components/common/Button'
import {
  useCreateMemory,
  useUpdateMemory,
} from '@/hooks/useMemories'
import { showToast } from '@/lib/toast'
import type { Memory, MemoryTier, ScheduleAgent } from '@/types/api'

interface Props {
  open: boolean
  onClose: () => void
  memory?: Memory | null
  defaultAgentId?: string
  agents: ScheduleAgent[]
}

const TIERS: Array<{ value: MemoryTier; label: string }> = [
  { value: 'hot', label: 'Hot — most aktív' },
  { value: 'warm', label: 'Warm — stabil konfig' },
  { value: 'cold', label: 'Cold — archívum' },
  { value: 'shared', label: 'Shared — más ágenseknek is' },
]

interface FormState {
  agent_id: string
  category: MemoryTier
  content: string
  keywords: string
}

const EMPTY: FormState = {
  agent_id: '',
  category: 'warm',
  content: '',
  keywords: '',
}

export function MemoryEditorModal({
  open,
  onClose,
  memory,
  defaultAgentId,
  agents,
}: Props) {
  const createMut = useCreateMemory()
  const updateMut = useUpdateMemory()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (memory) {
      setForm({
        agent_id: memory.agent_id,
        category: memory.category as MemoryTier,
        content: memory.content,
        keywords: memory.keywords ?? '',
      })
    } else {
      setForm({
        ...EMPTY,
        agent_id: defaultAgentId || agents[0]?.name || '',
      })
    }
    setError(null)
  }, [open, memory, defaultAgentId, agents])

  const submit = async () => {
    setError(null)
    if (!form.agent_id) return setError('Válassz ágenst.')
    if (!form.content.trim()) return setError('A tartalom kötelezô.')
    const payload = {
      agent_id: form.agent_id,
      category: form.category,
      content: form.content,
      keywords: form.keywords || undefined,
    }
    try {
      if (memory) {
        await updateMut.mutateAsync({ id: memory.id, patch: payload })
        showToast('Emlék frissítve', 'success')
      } else {
        await createMut.mutateAsync(payload)
        showToast('Emlék mentve', 'success')
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={memory ? 'Emlék szerkesztése' : 'Új emlék'}
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button onClick={onClose}>Mégse</Button>
          <Button
            variant="primary"
            onClick={submit}
            disabled={createMut.isPending || updateMut.isPending}
          >
            {createMut.isPending || updateMut.isPending ? 'Mentés…' : 'Mentés'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Ágens">
            <select
              value={form.agent_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, agent_id: e.target.value }))
              }
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none"
            >
              {agents.map((a) => (
                <option key={a.name} value={a.name}>
                  {a.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tier">
            <select
              value={form.category}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  category: e.target.value as MemoryTier,
                }))
              }
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none"
            >
              {TIERS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Tartalom">
          <textarea
            value={form.content}
            onChange={(e) =>
              setForm((f) => ({ ...f, content: e.target.value }))
            }
            rows={6}
            className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none"
          />
        </Field>

        <Field label="Kulcsszavak" hint="vesszôvel elválasztva">
          <input
            value={form.keywords}
            onChange={(e) =>
              setForm((f) => ({ ...f, keywords: e.target.value }))
            }
            placeholder="kulcs1, kulcs2"
            className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none"
          />
        </Field>

        {error ? (
          <div className="rounded-[var(--radius-sm)] border border-[var(--color-danger)] bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {error}
          </div>
        ) : null}
      </div>
    </Modal>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-baseline justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
          {label}
        </span>
        {hint ? (
          <span className="text-[11px] italic text-[var(--color-text-muted)]">
            {hint}
          </span>
        ) : null}
      </span>
      {children}
    </label>
  )
}
