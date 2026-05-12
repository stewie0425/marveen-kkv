import { useState } from 'react'
import { Modal } from '@/components/common/Modal'
import { Button } from '@/components/common/Button'
import { useCreateAgent, useSecurityProfiles } from '@/hooks/useAgents'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: (name: string) => void
}

const MODELS = [
  { value: 'claude-opus-4-7', label: 'Opus 4.7 (max képesség)' },
  { value: 'claude-sonnet-4-6', label: 'Sonnet 4.6 (gyors+olcsó)' },
  { value: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5 (ultra olcsó)' },
]

export function CreateAgentModal({ open, onClose, onCreated }: Props) {
  const profiles = useSecurityProfiles()
  const createMut = useCreateAgent()
  const [form, setForm] = useState({
    name: '',
    description: '',
    model: 'claude-opus-4-7',
    profile: 'developer-senior',
  })
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setForm({
      name: '',
      description: '',
      model: 'claude-opus-4-7',
      profile: 'developer-senior',
    })
    setError(null)
  }

  const submit = async () => {
    setError(null)
    if (!form.name.trim()) {
      setError('Add meg az ágens nevét.')
      return
    }
    try {
      const res = await createMut.mutateAsync(form)
      reset()
      onCreated(res.name)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset()
        onClose()
      }}
      title="Új ágens"
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button
            onClick={() => {
              reset()
              onClose()
            }}
          >
            Mégse
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            disabled={createMut.isPending}
          >
            {createMut.isPending ? 'Létrehozás…' : 'Létrehozás'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Név (slug-osítva lesz)" hint="csak betûk és kötôjel ajánlott">
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="pl. devops"
            className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none"
          />
        </Field>

        <Field label="Leírás" hint="rövid személyiség és felelôsségek">
          <textarea
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
            rows={4}
            placeholder="Te Kevin … asszisztense vagy …"
            className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none"
          />
        </Field>

        <Field label="Modell">
          <select
            value={form.model}
            onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
            className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none"
          >
            {MODELS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Biztonsági profil">
          <select
            value={form.profile}
            onChange={(e) =>
              setForm((f) => ({ ...f, profile: e.target.value }))
            }
            className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none"
          >
            {profiles.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            )) ?? <option>Betöltés…</option>}
          </select>
          {profiles.data ? (
            <p className="text-[11px] text-[var(--color-text-muted)]">
              {profiles.data.find((p) => p.id === form.profile)?.description}
            </p>
          ) : null}
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
