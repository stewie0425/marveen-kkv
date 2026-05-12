import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { userApiJson } from '@/lib/api'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/common/Button'
import { Modal } from '@/components/common/Modal'

interface DashboardUser {
  id: number
  email: string
  role: 'admin' | 'user'
  active: boolean
  created_at: number
}

function RoleBadge({ role }: { role: 'admin' | 'user' }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
      role === 'admin'
        ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
        : 'bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)]'
    }`}>
      {role}
    </span>
  )
}

function formatDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString('hu-HU', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function UsersPage() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [editUser, setEditUser] = useState<DashboardUser | null>(null)

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['dashboard-users'],
    queryFn: () => userApiJson<DashboardUser[]>('/api/user-management/users'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => userApiJson(`/api/user-management/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dashboard-users'] }),
  })

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      userApiJson(`/api/user-management/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dashboard-users'] }),
  })

  return (
    <div>
      <PageHeader
        title="Felhasználók"
        subtitle="Dashboard hozzáférés kezelése"
        actions={<Button onClick={() => setShowCreate(true)}>Új felhasználó</Button>}
      />

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
        {isLoading ? (
          <div className="py-12 text-center text-sm text-[var(--color-text-muted)]">Betöltés…</div>
        ) : users.length === 0 ? (
          <div className="py-12 text-center text-sm text-[var(--color-text-muted)]">Még nincs felhasználó.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-text-muted)] uppercase tracking-wide">
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Szerepkör</th>
                <th className="px-4 py-3 font-medium">Létrehozva</th>
                <th className="px-4 py-3 font-medium">Aktív</th>
                <th className="px-4 py-3 font-medium text-right">Műveletek</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-[var(--color-surface-hover)] transition-colors">
                  <td className="px-4 py-3 font-medium">{u.email}</td>
                  <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)]">{formatDate(u.created_at)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive.mutate({ id: u.id, active: !u.active })}
                      className={`relative h-5 w-9 rounded-full transition-colors ${u.active ? 'bg-[var(--color-success)]' : 'bg-[var(--color-border)]'}`}
                      aria-label={u.active ? 'Deaktiválás' : 'Aktiválás'}
                    >
                      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${u.active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setEditUser(u)}
                        className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                      >
                        Szerkesztés
                      </button>
                      <button
                        onClick={() => { if (confirm(`Törlöd: ${u.email}?`)) deleteMut.mutate(u.id) }}
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

      {showCreate && <UserFormModal mode="create" onClose={() => setShowCreate(false)} />}
      {editUser && <UserFormModal mode="edit" user={editUser} onClose={() => setEditUser(null)} />}
    </div>
  )
}

interface UserFormModalProps {
  mode: 'create' | 'edit'
  user?: DashboardUser
  onClose: () => void
}

function UserFormModal({ mode, user, onClose }: UserFormModalProps) {
  const qc = useQueryClient()
  const [email, setEmail] = useState(user?.email ?? '')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'admin' | 'user'>(user?.role ?? 'user')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPending(true)
    setError(null)
    try {
      if (mode === 'create') {
        if (password.length < 8) { setError('A jelszó legalább 8 karakter legyen.'); setPending(false); return }
        await userApiJson('/api/user-management/users', {
          method: 'POST',
          body: JSON.stringify({ email, password, role }),
        })
      } else {
        const body: Record<string, unknown> = { role }
        if (password.length >= 8) body.password = password
        await userApiJson(`/api/user-management/users/${user!.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        })
      }
      await qc.invalidateQueries({ queryKey: ['dashboard-users'] })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sikertelen.')
      setPending(false)
    }
  }

  return (
    <Modal open title={mode === 'create' ? 'Új felhasználó' : 'Felhasználó szerkesztése'} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Email</span>
          <input
            type="email"
            required
            value={email}
            disabled={mode === 'edit'}
            onChange={e => setEmail(e.target.value)}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2 text-sm focus:border-[var(--color-border-focus)] focus:outline-none disabled:opacity-50"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
            {mode === 'edit' ? 'Új jelszó (hagyja üresen ha nem változik)' : 'Jelszó'}
          </span>
          <input
            type="password"
            required={mode === 'create'}
            minLength={mode === 'create' ? 8 : 0}
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2 text-sm focus:border-[var(--color-border-focus)] focus:outline-none"
            placeholder={mode === 'edit' ? 'Változatlan' : 'Legalább 8 karakter'}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Szerepkör</span>
          <select
            value={role}
            onChange={e => setRole(e.target.value as 'admin' | 'user')}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2 text-sm focus:border-[var(--color-border-focus)] focus:outline-none"
          >
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>
        </label>

        {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Mégse</Button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
          >
            {pending ? 'Mentés…' : 'Mentés'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
