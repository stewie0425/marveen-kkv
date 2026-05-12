import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiJson } from '@/lib/api'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/common/Button'
import { Modal } from '@/components/common/Modal'

interface SecretMeta {
  id: number
  key_name: string
  description: string | null
  created_at: number
  updated_at: number
}

interface SecretFull extends SecretMeta {
  value: string
}

function formatDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString('hu-HU', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

function KeyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  )
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

export default function VaultPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editKey, setEditKey] = useState<string | null>(null)
  const [revealed, setRevealed] = useState<Record<string, string>>({})
  const [revealing, setRevealing] = useState<Record<string, boolean>>({})
  const [copied, setCopied] = useState<string | null>(null)

  const { data: secrets = [], isLoading } = useQuery({
    queryKey: ['vault-secrets'],
    queryFn: () => apiJson<SecretMeta[]>('/api/vault-secrets'),
  })

  const deleteMut = useMutation({
    mutationFn: (keyName: string) =>
      apiJson(`/api/vault-secrets/${encodeURIComponent(keyName)}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vault-secrets'] })
      setRevealed({})
    },
  })

  async function revealSecret(keyName: string) {
    if (revealed[keyName]) {
      setRevealed(r => { const n = { ...r }; delete n[keyName]; return n })
      return
    }
    setRevealing(r => ({ ...r, [keyName]: true }))
    try {
      const data = await apiJson<SecretFull>(`/api/vault-secrets/${encodeURIComponent(keyName)}`)
      setRevealed(r => ({ ...r, [keyName]: data.value }))
    } finally {
      setRevealing(r => { const n = { ...r }; delete n[keyName]; return n })
    }
  }

  async function copySecret(keyName: string) {
    let value = revealed[keyName]
    if (!value) {
      const data = await apiJson<SecretFull>(`/api/vault-secrets/${encodeURIComponent(keyName)}`)
      value = data.value
    }
    await navigator.clipboard.writeText(value)
    setCopied(keyName)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div>
      <PageHeader
        title="Vault"
        subtitle="Titkosított kulcs-érték tároló (AES-256-GCM)"
        actions={<Button onClick={() => { setEditKey(null); setShowForm(true) }}>Új titok</Button>}
      />

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
        {isLoading ? (
          <div className="py-12 text-center text-sm text-[var(--color-text-muted)]">Betöltés…</div>
        ) : secrets.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <div className="text-[var(--color-text-muted)]"><KeyIcon /></div>
            <p className="text-sm text-[var(--color-text-muted)]">Még nincs tárolt titok.</p>
            <Button onClick={() => { setEditKey(null); setShowForm(true) }}>Első titok hozzáadása</Button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-text-muted)] uppercase tracking-wide">
                <th className="px-4 py-3 font-medium">Kulcs</th>
                <th className="px-4 py-3 font-medium">Leírás</th>
                <th className="px-4 py-3 font-medium">Érték</th>
                <th className="px-4 py-3 font-medium">Módosítva</th>
                <th className="px-4 py-3 font-medium text-right">Műveletek</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {secrets.map(s => (
                <tr key={s.key_name} className="hover:bg-[var(--color-surface-hover)] transition-colors group">
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs bg-[var(--color-code)] px-1.5 py-0.5 rounded text-[var(--color-text)]">
                      {s.key_name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)] text-xs">
                    {s.description || <span className="italic opacity-40">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {revealed[s.key_name] ? (
                        <span className="font-mono text-xs break-all max-w-[240px]">{revealed[s.key_name]}</span>
                      ) : (
                        <span className="font-mono text-xs text-[var(--color-text-muted)]">••••••••</span>
                      )}
                      <button
                        onClick={() => revealSecret(s.key_name)}
                        disabled={revealing[s.key_name]}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                        title={revealed[s.key_name] ? 'Elrejtés' : 'Megmutatás'}
                      >
                        <EyeIcon open={!!revealed[s.key_name]} />
                      </button>
                      <button
                        onClick={() => copySecret(s.key_name)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                        title="Másolás"
                      >
                        {copied === s.key_name ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                        )}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--color-text-muted)] whitespace-nowrap">
                    {formatDate(s.updated_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => { setEditKey(s.key_name); setShowForm(true) }}
                        className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                      >
                        Szerkesztés
                      </button>
                      <button
                        onClick={() => { if (confirm(`Törlöd: ${s.key_name}?`)) deleteMut.mutate(s.key_name) }}
                        className="text-xs text-[var(--color-danger)] hover:opacity-70 transition-opacity"
                      >
                        Törlés
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <VaultSecretModal
          editKey={editKey}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  )
}

interface VaultSecretModalProps {
  editKey: string | null
  onClose: () => void
}

function VaultSecretModal({ editKey, onClose }: VaultSecretModalProps) {
  const qc = useQueryClient()
  const isEdit = !!editKey
  const [key, setKey] = useState(editKey ?? '')
  const [value, setValue] = useState('')
  const [description, setDescription] = useState('')
  const [showValue, setShowValue] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingExisting, setLoadingExisting] = useState(isEdit)

  // Load existing value for edit
  useState(() => {
    if (!editKey) return
    apiJson<SecretFull>(`/api/vault-secrets/${encodeURIComponent(editKey)}`)
      .then(d => { setValue(d.value); setDescription(d.description ?? ''); setLoadingExisting(false) })
      .catch(() => setLoadingExisting(false))
  })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!key.trim() || !value) return
    setPending(true)
    setError(null)
    try {
      await apiJson('/api/vault-secrets', {
        method: 'POST',
        body: JSON.stringify({ key: key.trim(), value, description: description || undefined }),
      })
      await qc.invalidateQueries({ queryKey: ['vault-secrets'] })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sikertelen.')
      setPending(false)
    }
  }

  return (
    <Modal open title={isEdit ? 'Titok szerkesztése' : 'Új titok'} onClose={onClose}>
      {loadingExisting ? (
        <div className="py-8 text-center text-sm text-[var(--color-text-muted)]">Betöltés…</div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Kulcs</span>
            <input
              type="text"
              required
              disabled={isEdit}
              value={key}
              onChange={e => setKey(e.target.value)}
              placeholder="pl. OPENAI_API_KEY"
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2 font-mono text-sm focus:border-[var(--color-border-focus)] focus:outline-none disabled:opacity-50"
            />
            <span className="text-xs text-[var(--color-text-muted)]">Betűk, számok, _, ., -, / megengedett</span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Érték</span>
            <div className="relative">
              <input
                type={showValue ? 'text' : 'password'}
                required
                value={value}
                onChange={e => setValue(e.target.value)}
                placeholder="titkos érték"
                className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2 pr-9 font-mono text-sm focus:border-[var(--color-border-focus)] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowValue(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              >
                <EyeIcon open={showValue} />
              </button>
            </div>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Leírás (opcionális)</span>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Mire való?"
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2 text-sm focus:border-[var(--color-border-focus)] focus:outline-none"
            />
          </label>

          {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} type="button">Mégse</Button>
            <button
              type="submit"
              disabled={pending || !key.trim() || !value}
              className="rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
            >
              {pending ? 'Mentés…' : 'Mentés'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
