import { useEffect, useState } from 'react'
import { Modal } from '@/components/common/Modal'
import { Button } from '@/components/common/Button'
import {
  useCreateSchedule,
  useUpdateSchedule,
} from '@/hooks/useSchedules'
import { showToast } from '@/lib/toast'
import type { ScheduleAgent, ScheduleTask, ScheduleType } from '@/types/api'

interface Props {
  open: boolean
  onClose: () => void
  task?: ScheduleTask | null
  agents: ScheduleAgent[]
}

interface FormState {
  name: string
  description: string
  prompt: string
  schedule: string
  agent: string
  type: 'task' | 'heartbeat'
}

const EMPTY: FormState = {
  name: '',
  description: '',
  prompt: '',
  schedule: '0 8 * * *',
  agent: '',
  type: 'task',
}

const TYPES: Array<{ value: 'task' | 'heartbeat'; label: string; hint: string }> = [
  {
    value: 'task',
    label: 'Task (mindig értesít)',
    hint: 'Telegramra is kimegy az eredmény.',
  },
  {
    value: 'heartbeat',
    label: 'Heartbeat (csendes)',
    hint: 'Csak akkor szól, ha fontos / sürgôs.',
  },
]

export function ScheduleEditorModal({ open, onClose, task, agents }: Props) {
  const createMut = useCreateSchedule()
  const updateMut = useUpdateSchedule()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (task) {
      setForm({
        name: task.name,
        description: task.description || '',
        prompt: task.prompt || '',
        schedule: task.schedule,
        agent: task.agent,
        type: (task.type as 'task' | 'heartbeat') || 'task',
      })
    } else {
      setForm({
        ...EMPTY,
        agent: agents[0]?.name ?? '',
      })
    }
    setError(null)
  }, [open, task, agents])

  const submit = async () => {
    setError(null)
    if (!form.name.trim()) return setError('A név kötelezô.')
    if (!form.prompt.trim()) return setError('A prompt kötelezô.')
    if (!form.schedule.trim()) return setError('A cron kifejezés kötelezô.')
    if (!form.agent) return setError('Válassz ágenst.')
    try {
      if (task) {
        await updateMut.mutateAsync({ name: task.name, patch: form })
        showToast('Feladat frissítve', 'success')
      } else {
        await createMut.mutateAsync(form)
        showToast('Feladat létrehozva', 'success')
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
      title={task ? 'Feladat szerkesztése' : 'Új ütemezett feladat'}
      size="lg"
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
          <Field label="Név (slug)">
            <input
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({ ...f, name: e.target.value }))
              }
              disabled={!!task}
              placeholder="napi-osszefoglalo"
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2 font-mono text-sm focus:border-[var(--color-accent)] focus:outline-none disabled:opacity-60"
            />
          </Field>
          <Field label="Cron kifejezés" hint="perc óra nap hónap hétnap">
            <input
              value={form.schedule}
              onChange={(e) =>
                setForm((f) => ({ ...f, schedule: e.target.value }))
              }
              placeholder="0 8 * * *"
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2 font-mono text-sm focus:border-[var(--color-accent)] focus:outline-none"
            />
          </Field>
        </div>

        <Field label="Leírás">
          <input
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
            placeholder="Mit csinál ez a feladat?"
            className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none"
          />
        </Field>

        <Field label="Prompt">
          <textarea
            value={form.prompt}
            onChange={(e) =>
              setForm((f) => ({ ...f, prompt: e.target.value }))
            }
            rows={6}
            placeholder="A részletes prompt amit a runner az ágens session-jébe küld."
            className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none"
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Ágens">
            <select
              value={form.agent}
              onChange={(e) =>
                setForm((f) => ({ ...f, agent: e.target.value }))
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
          <Field label="Típus">
            <select
              value={form.type}
              onChange={(e) =>
                setForm((f) => ({ ...f, type: e.target.value as ScheduleType as 'task' | 'heartbeat' }))
              }
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none"
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              {TYPES.find((t) => t.value === form.type)?.hint}
            </p>
          </Field>
        </div>

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
