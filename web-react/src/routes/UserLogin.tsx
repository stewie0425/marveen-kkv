import { useState } from 'react'
import { setUserSession, userApiJson } from '@/lib/api'

interface Props {
  onSuccess: (role: 'admin' | 'user') => void
  onAdminToken?: () => void
}

export default function UserLoginPage({ onSuccess, onAdminToken }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPending(true)
    setError(null)
    try {
      const data = await userApiJson<{ token: string; role: 'admin' | 'user'; email: string }>(
        '/api/user-auth/login',
        { method: 'POST', body: JSON.stringify({ email, password }) },
      )
      setUserSession(data.token, data.role, data.email)
      onSuccess(data.role)
    } catch {
      setError('Hibás email vagy jelszó.')
      setPending(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-4">
      <div className="w-full max-w-sm space-y-4">
        <form
          onSubmit={submit}
          className="flex flex-col gap-5 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-[var(--shadow-lg)]"
        >
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-accent)] text-xl font-bold text-white">
              M
            </div>
            <h1 className="text-lg font-semibold">Bejelentkezés</h1>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Email</span>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2 text-sm focus:border-[var(--color-border-focus)] focus:outline-none"
              placeholder="email@example.com"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Jelszó</span>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2 text-sm focus:border-[var(--color-border-focus)] focus:outline-none"
              placeholder="••••••••"
            />
          </label>

          {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
          >
            {pending ? 'Bejelentkezés…' : 'Bejelentkezés'}
          </button>
        </form>

        {onAdminToken && (
          <button
            onClick={onAdminToken}
            className="w-full text-center text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          >
            Admin token beírása
          </button>
        )}
      </div>
    </div>
  )
}
