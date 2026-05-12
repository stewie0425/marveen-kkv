import { useState } from 'react'
import { setUserSession, setAuthToken, userApiJson } from '@/lib/api'
import { setAuthStatus } from '@/lib/auth'

interface Props {
  onComplete: () => void
}

export default function SetupPage({ onComplete }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== password2) { setError('A két jelszó nem egyezik.'); return }
    if (password.length < 8) { setError('A jelszó legalább 8 karakter legyen.'); return }
    setPending(true)
    setError(null)
    try {
      const data = await userApiJson<{ token: string; role: 'admin' | 'user'; email: string; adminToken: string }>(
        '/api/user-auth/setup',
        { method: 'POST', body: JSON.stringify({ email, password }) },
      )
      setUserSession(data.token, data.role, data.email)
      setAuthToken(data.adminToken)
      setAuthStatus('authenticated')
      onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sikertelen.')
      setPending(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-4">
      <form
        onSubmit={submit}
        className="flex w-full max-w-sm flex-col gap-5 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-[var(--shadow-lg)]"
      >
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-accent)] text-xl font-bold text-white">
            M
          </div>
          <h1 className="text-lg font-semibold">Első bejelentkezés</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Hozd létre az első admin fiókot.
          </p>
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
            placeholder="admin@example.com"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Jelszó</span>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2 text-sm focus:border-[var(--color-border-focus)] focus:outline-none"
            placeholder="Legalább 8 karakter"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Jelszó ismét</span>
          <input
            type="password"
            required
            value={password2}
            onChange={e => setPassword2(e.target.value)}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2 text-sm focus:border-[var(--color-border-focus)] focus:outline-none"
            placeholder="Ismételd meg"
          />
        </label>

        {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
        >
          {pending ? 'Létrehozás…' : 'Fiók létrehozása'}
        </button>
      </form>
    </div>
  )
}
