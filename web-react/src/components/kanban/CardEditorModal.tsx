import { useEffect, useState } from 'react'
import { Modal } from '@/components/common/Modal'
import { Button } from '@/components/common/Button'
import {
  useCreateKanbanCard,
  useUpdateKanbanCard,
} from '@/hooks/useKanban'
import { showToast } from '@/lib/toast'
import type {
  Assignee,
  KanbanCard,
  KanbanPriority,
  KanbanStatus,
} from '@/types/api'

interface Props {
  open: boolean
  onClose: () => void
  // For new card mode, pass `defaultStatus`. For edit, pass `card`.
  card?: KanbanCard | null
  defaultStatus?: KanbanStatus
  assignees: Assignee[]
}

const PRIORITIES: Array<{ value: KanbanPriority; label: string }> = [
  { value: 'low', label: 'Alacsony' },
  { value: 'normal', label: 'Normál' },
  { value: 'high', label: 'Magas' },
  { value: 'urgent', label: 'Sürgôs' },
]

interface FormState {
  title: string
  description: string
  assignee: string
  priority: KanbanPriority
  due_date: string // YYYY-MM-DD
  status: KanbanStatus
}

const EMPTY: FormState = {
  title: '',
  description: '',
  assignee: '',
  priority: 'normal',
  due_date: '',
  status: 'planned',
}

function dateToInput(epochSec: number | null | undefined): string {
  if (!epochSec) return ''
  const d = new Date(epochSec * 1000)
  if (isNaN(d.getTime())) return ''
  return d.toISOString().split('T')[0]
}

function inputToEpochSec(s: string): number | null {
  if (!s) return null
  const ms = new Date(s).getTime()
  return isNaN(ms) ? null : Math.floor(ms / 1000)
}

export function CardEditorModal({
  open,
  onClose,
  card,
  defaultStatus,
  assignees,
}: Props) {
  const createMut = useCreateKanbanCard()
  const updateMut = useUpdateKanbanCard()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (card) {
      setForm({
        title: card.title,
        description: card.description ?? '',
        assignee: card.assignee ?? '',
        priority: card.priority,
        due_date: dateToInput(card.due_date),
        status: card.status,
      })
    } else {
      setForm({ ...EMPTY, status: defaultStatus ?? 'planned' })
    }
    setError(null)
  }, [open, card, defaultStatus])

  const submit = async () => {
    setError(null)
    const title = form.title.trim()
    if (!title) {
      setError('A cím kötelezô.')
      return
    }
    const payload = {
      title,
      description: form.description.trim() || null,
      assignee: form.assignee || null,
      priority: form.priority,
      due_date: inputToEpochSec(form.due_date),
    }
    try {
      if (card) {
        await updateMut.mutateAsync({ id: card.id, patch: payload })
        showToast('Kártya frissítve', 'success')
      } else {
        await createMut.mutateAsync({ ...payload, status: form.status })
        showToast('Kártya létrehozva', 'success')
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
      title={card ? 'Kártya szerkesztése' : 'Új kártya'}
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
        <Field label="Cím">
          <input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            autoFocus
            className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none"
          />
        </Field>

        <Field label="Leírás">
          <textarea
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
            rows={4}
            className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none"
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Felelôs">
            <select
              value={form.assignee}
              onChange={(e) =>
                setForm((f) => ({ ...f, assignee: e.target.value }))
              }
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none"
            >
              <option value="">— Nincs —</option>
              {assignees.map((a) => (
                <option key={a.name} value={a.name}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Prioritás">
            <select
              value={form.priority}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  priority: e.target.value as KanbanPriority,
                }))
              }
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none"
            >
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Határidô">
          <input
            type="date"
            value={form.due_date}
            onChange={(e) =>
              setForm((f) => ({ ...f, due_date: e.target.value }))
            }
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
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
        {label}
      </span>
      {children}
    </label>
  )
}
