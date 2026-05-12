import { clearAuthToken } from '@/lib/api'
import { setAuthStatus } from '@/lib/auth'

interface Props {
  onAfterLogout?: () => void
  className?: string
}

// Tiny button used in both the desktop sidebar and the mobile menu so the
// behaviour stays consistent. Clears the persisted token and flips the
// app to the unauthenticated state, which causes AuthGate to render the
// LoginScreen on the next tick.
export function LogoutButton({ onAfterLogout, className = '' }: Props) {
  return (
    <button
      type="button"
      onClick={() => {
        clearAuthToken()
        setAuthStatus('unauthenticated')
        onAfterLogout?.()
      }}
      aria-label="Kijelentkezés"
      title="Kijelentkezés"
      className={[
        'flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]',
        className,
      ].join(' ')}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
    </button>
  )
}
