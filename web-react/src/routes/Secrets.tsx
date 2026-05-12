import { useState } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/common/Button'
import { useSecretList, useDeleteSecret } from '@/hooks/useSecrets'
import { showToast } from '@/lib/toast'
import { SecretAddModal } from '@/components/secrets/SecretAddModal'
import { SecretEditModal } from '@/components/secrets/SecretEditModal'
import type { SecretListItem } from '@/types/api'

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(epoch: number): string {
  if (!epoch) return '—'
  return new Date(epoch * 1000).toLocaleString('hu-HU')
}

// Pencil icon
function EditIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

export default function SecretsPage() {
  const list = useSecretList()
  const delMut = useDeleteSecret()
  const [addOpen, setAddOpen] = useState(false)
  const [editSecret, setEditSecret] = useState<SecretListItem | null>(null)
  const [confirmName, setConfirmName] = useState<string | null>(null)

  const items: SecretListItem[] = list.data ?? []

  const remove = async (name: string) => {
    if (confirmName !== name) {
      setConfirmName(name)
      return
    }
    try {
      await delMut.mutateAsync(name)
      showToast(`Titok törölve: ${name}`, 'success')
      setConfirmName(null)
    } catch (e) {
      showToast(
        e instanceof Error ? e.message : 'Törlés hiba',
        'error',
      )
    }
  }

  return (
    <section>
      <PageHeader
        title="Titkok"
        subtitle="API kulcsok és más titkok az /etc/marveen/*.env fájlokban. Az értékek soha nem folynak vissza, csak metaadat látszik."
        actions={
          <Button variant="primary" onClick={() => setAddOpen(true)}>
            Új titok
          </Button>
        }
      />

      {list.isLoading ? (
        <EmptyState>Betöltés…</EmptyState>
      ) : list.isError ? (
        <EmptyState tone="error">
          {list.error instanceof Error
            ? list.error.message
            : 'Hiba a titkok listázásakor.'}
        </EmptyState>
      ) : items.length === 0 ? (
        <EmptyState>
          Még nincs titok. Az „Új titok" gombbal vehetsz fel egyet.
        </EmptyState>
      ) : (
        <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)]">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--color-border)] bg-[var(--color-surface-hover)] text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Név</th>
                <th className="px-4 py-2 text-left font-medium">Env fájl</th>
                <th className="px-4 py-2 text-right font-medium">Méret</th>
                <th className="px-4 py-2 text-left font-medium">Utolsó módosítás</th>
                <th className="px-4 py-2 text-right font-medium" />
              </tr>
            </thead>
            <tbody>
              {items.map((s) => {
                const confirming = confirmName === s.name
                return (
                  <tr
                    key={s.name}
                    className="border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-surface-hover)]"
                  >
                    <td className="px-4 py-2 font-mono text-[var(--color-text)]">
                      {s.name}
                    </td>
                    <td className="px-4 py-2 font-mono text-[var(--color-text-secondary)]">
                      {s.target_env_path}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-[var(--color-text-secondary)]">
                      {formatBytes(s.size)}
                    </td>
                    <td className="px-4 py-2 tabular-nums text-[var(--color-text-secondary)]">
                      {formatDate(s.last_modified)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setConfirmName(null)
                            setEditSecret(s)
                          }}
                          aria-label={`${s.name} szerkesztése`}
                          title="Szerkesztés"
                        >
                          <EditIcon />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => remove(s.name)}
                          disabled={delMut.isPending}
                          className="text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]"
                        >
                          {confirming ? 'Tényleg?' : 'Törlés'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <SecretAddModal open={addOpen} onClose={() => setAddOpen(false)} />
      <SecretEditModal
        secret={editSecret}
        onClose={() => setEditSecret(null)}
      />
    </section>
  )
}
