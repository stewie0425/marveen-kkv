import { Link, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { ThemeToggle } from './ThemeToggle'
import { LogoutButton } from './LogoutButton'

const ROUTES: Array<{ to: string; label: string }> = [
  { to: '/', label: 'Áttekintés' },
  { to: '/kanban', label: 'Kanban' },
  { to: '/agents', label: 'Ügynökök' },
  { to: '/team', label: 'Csapat' },
  { to: '/schedules', label: 'Ütemezések' },
  { to: '/memories', label: 'Memória' },
  { to: '/vault', label: 'Vault' },
  { to: '/secrets', label: 'Titkok' },
  { to: '/skills', label: 'Skillek' },
  { to: '/mcp', label: 'MCP' },
  { to: '/migrate', label: 'Költöztetés' },
  { to: '/status', label: 'Státusz' },
  { to: '/sessions', label: 'Sessions' },
  { to: '/updates', label: 'Frissítések' },
]

export function MobileNav() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const current = ROUTES.find((r) => r.to === location.pathname)?.label ?? 'Marveen'

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Menü"
        className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border)] text-[var(--color-text)]"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {open ? (
            <>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </>
          ) : (
            <>
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </>
          )}
        </svg>
      </button>
      <div className="text-base font-semibold tracking-tight">{current}</div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <LogoutButton onAfterLogout={() => setOpen(false)} />
      </div>

      {open ? (
        <nav className="absolute inset-x-0 top-full flex flex-col border-b border-[var(--color-border)] bg-[var(--color-surface)] py-2 shadow-[var(--shadow-md)]">
          {ROUTES.map((r) => (
            <Link
              key={r.to}
              to={r.to}
              onClick={() => setOpen(false)}
              className={[
                'px-4 py-2.5 text-sm',
                location.pathname === r.to
                  ? 'bg-[var(--color-accent-soft)] text-[var(--color-text)]'
                  : 'text-[var(--color-text-secondary)]',
              ].join(' ')}
            >
              {r.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </header>
  )
}
