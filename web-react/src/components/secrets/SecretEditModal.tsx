import { useEffect, useState } from 'react'
import { Modal } from '@/components/common/Modal'
import { Button } from '@/components/common/Button'
import { useAddSecret } from '@/hooks/useSecrets'
import { showToast } from '@/lib/toast'
import type { SecretListItem } from '@/types/api'

interface Props {
  secret: SecretListItem | null
  onClose: () => void
}

function formatDate(epoch: number): string {
  if (!epoch) return '—'
  return new Date(epoch * 1000).toLocaleString('hu-HU')
}

export function SecretEditModal({ secret, onClose }: Props) {
  const [value, setValue] = useState('')
  const [revealed, setRevealed] = useState(false)
  const addMut = useAddSecret()

  useEffect(() => {
    if (!secret) {
      setValue('')
      setRevealed(false)
    }
  }, [secret])

  const valueValid = value.length > 0 && !value.includes('\n')
  const canSubmit = valueValid && !addMut.isPending

  const submit = async () => {
    if (!canSubmit || !secret) return
    try {
      const res = await addMut.mutateAsync({
        name: secret.name,
        value,
        target_env_path: secret.target_env_path,
      })
      showToast(`Titok frissítve: ${res.target} (${res.size} B)`, 'success')
      onClose()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      let friendly = 'Szerver hiba'
      if (msg.startsWith('HTTP 400')) friendly = 'Érvénytelen adat'
      else if (msg.startsWith('HTTP 413')) friendly = 'Túl nagy érték'
      else if (msg.startsWith('HTTP 4')) friendly = 'Elutasítva'
      showToast(`${friendly}: ${msg}`, 'error')
    }
  }

  return (
    <Modal
      open={secret !== null}
      onClose={onClose}
      title="Titok szerkesztése"
      size="sm"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={addMut.isPending}>
            Mégse
          </Button>
          <Button variant="primary" onClick={submit} disabled={!canSubmit}>
            {addMut.isPending ? 'Mentés…' : 'Mentés'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {/* Read-only meta */}
        <div className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 py-2 text-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="text-[11px] text-[var(--color-text-muted)]">Név</span>
              <p className="font-mono font-medium text-[var(--color-text)]">{secret?.name}</p>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-[var(--color-text-muted)]">Utolsó módosítás</span>
              <p className="text-[12px] tabular-nums text-[var(--color-text-secondary)]">
                {formatDate(secret?.last_modified ?? 0)}
              </p>
            </div>
          </div>
          <div className="mt-1.5">
            <span className="text-[11px] text-[var(--color-text-muted)]">Fájl</span>
            <p className="truncate font-mono text-[12px] text-[var(--color-text-secondary)]">
              {secret?.target_env_path}
            </p>
          </div>
        </div>

        {/* New value */}
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Új érték</span>
          <div className="flex items-stretch gap-1.5">
            <input
              type={revealed ? 'text' : 'password'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="••••••••"
              autoComplete="off"
              autoFocus
              spellCheck={false}
              aria-invalid={value.length > 0 && !valueValid}
              className="flex-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2 text-sm font-mono focus:border-[var(--color-accent)] focus:outline-none aria-[invalid=true]:border-[var(--color-danger)]"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRevealed((v) => !v)}
              aria-label={revealed ? 'Elrejtés' : 'Megjelenítés'}
            >
              {revealed ? 'Elrejt' : 'Mutat'}
            </Button>
          </div>
          <span className="text-[11px] text-[var(--color-text-muted)]">
            A régi értéket azonnal felülírja. A visszaolvasás nem lehetséges.
          </span>
        </label>
      </div>
    </Modal>
  )
}
