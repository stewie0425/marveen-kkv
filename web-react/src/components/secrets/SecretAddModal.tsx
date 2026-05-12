import { useEffect, useState } from 'react'
import { Modal } from '@/components/common/Modal'
import { Button } from '@/components/common/Button'
import { useAddSecret } from '@/hooks/useSecrets'
import { showToast } from '@/lib/toast'

interface Props {
  open: boolean
  onClose: () => void
}

const NAME_REGEX = /^[A-Z][A-Z0-9_]{0,63}$/

function defaultPath(name: string): string {
  const slug = name.trim().toLowerCase().replace(/_/g, '-')
  return slug ? `/etc/marveen/${slug}.env` : '/etc/marveen/'
}

export function SecretAddModal({ open, onClose }: Props) {
  const [name, setName] = useState('')
  const [value, setValue] = useState('')
  const [path, setPath] = useState('')
  const [pathTouched, setPathTouched] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const addMut = useAddSecret()

  useEffect(() => {
    if (!open) {
      setName('')
      setValue('')
      setPath('')
      setPathTouched(false)
      setRevealed(false)
    }
  }, [open])

  // Auto-fill the target path from the name until the user edits it.
  useEffect(() => {
    if (!pathTouched) setPath(defaultPath(name))
  }, [name, pathTouched])

  const nameValid = NAME_REGEX.test(name)
  const valueValid = value.length > 0 && !value.includes('\n')
  const pathValid = path.startsWith('/etc/marveen/') && path.endsWith('.env')
  const canSubmit = nameValid && valueValid && pathValid && !addMut.isPending

  const submit = async () => {
    if (!canSubmit) return
    try {
      const res = await addMut.mutateAsync({ name, value, target_env_path: path })
      showToast(`Titok mentve: ${res.target} (${res.size} B)`, 'success')
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
      open={open}
      onClose={onClose}
      title="Új titok"
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
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Név</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value.toUpperCase())}
            placeholder="API_KEY_NAME"
            autoCapitalize="characters"
            spellCheck={false}
            aria-invalid={name.length > 0 && !nameValid}
            className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2 text-sm font-mono uppercase focus:border-[var(--color-accent)] focus:outline-none aria-[invalid=true]:border-[var(--color-danger)]"
          />
          <span className="text-[11px] text-[var(--color-text-muted)]">
            Csak nagybetűk, számok és aláhúzás. Kötelezően nagybetűvel kezdődik. Max 64 karakter.
          </span>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Érték</span>
          <div className="flex items-stretch gap-1.5">
            <input
              type={revealed ? 'text' : 'password'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="••••••••"
              autoComplete="off"
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
            Soha nem olvassuk vissza. Új mentés felülírja a meglévőt.
          </span>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Cél env fájl</span>
          <input
            value={path}
            onChange={(e) => {
              setPathTouched(true)
              setPath(e.target.value)
            }}
            placeholder="/etc/marveen/example.env"
            spellCheck={false}
            aria-invalid={path.length > 0 && !pathValid}
            className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2 text-sm font-mono focus:border-[var(--color-accent)] focus:outline-none aria-[invalid=true]:border-[var(--color-danger)]"
          />
          <span className="text-[11px] text-[var(--color-text-muted)]">
            /etc/marveen/ alá írunk, .env végződéssel. Tipp: a név alapján automatikusan kitöltöm.
          </span>
        </label>
      </div>
    </Modal>
  )
}
