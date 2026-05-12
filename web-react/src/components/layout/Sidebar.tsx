import { NavLink } from 'react-router-dom'
import { ThemeToggle } from './ThemeToggle'
import { LogoutButton } from './LogoutButton'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
}

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2 }

const NAV: NavItem[] = [
  {
    to: '/',
    label: 'Áttekintés',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    to: '/kanban',
    label: 'Kanban',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}>
        <rect x="3" y="4" width="5" height="16" rx="1" />
        <rect x="10" y="4" width="5" height="10" rx="1" />
        <rect x="17" y="4" width="4" height="13" rx="1" />
      </svg>
    ),
  },
  {
    to: '/agents',
    label: 'Ügynökök',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    to: '/team',
    label: 'Csapat',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}>
        <circle cx="12" cy="5" r="3" />
        <path d="M12 8v4" />
        <circle cx="5" cy="18" r="3" />
        <circle cx="19" cy="18" r="3" />
        <path d="M12 12l-7 6M12 12l7 6" />
      </svg>
    ),
  },
  {
    to: '/schedules',
    label: 'Ütemezések',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}>
        <circle cx="12" cy="12" r="9" />
        <polyline points="12 7 12 12 15 14" />
      </svg>
    ),
  },
  {
    to: '/memories',
    label: 'Memória',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}>
        <path d="M12 3C7.5 3 4 6.5 4 11v4l-2 3h4v2a3 3 0 0 0 3 3h1a3 3 0 0 0 3-3v0a3 3 0 0 0 3 3h1a3 3 0 0 0 3-3v-2h4l-2-3v-4c0-4.5-3.5-8-8-8z" />
      </svg>
    ),
  },
  {
    to: '/vault',
    label: 'Vault',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
  },
  {
    to: '/secrets',
    label: 'Titkok',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}>
        <circle cx="8" cy="15" r="4" />
        <path d="M10.85 12.15 19 4" />
        <path d="m18 5 3 3" />
        <path d="m15 8 3 3" />
      </svg>
    ),
  },
  {
    to: '/skills',
    label: 'Skillek',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}>
        <polygon points="12 2 15 8.5 22 9.3 17 14.2 18.2 21 12 17.8 5.8 21 7 14.2 2 9.3 9 8.5" />
      </svg>
    ),
  },
  {
    to: '/mcp',
    label: 'MCP',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}>
        <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" />
        <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" />
      </svg>
    ),
  },
  {
    to: '/migrate',
    label: 'Költöztetés',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}>
        <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
        <polyline points="7 10 12 5 17 10" />
        <line x1="12" y1="5" x2="12" y2="17" />
      </svg>
    ),
  },
  {
    to: '/status',
    label: 'Státusz',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}>
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    to: '/sessions',
    label: 'Sessions',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}>
        <circle cx="12" cy="12" r="3" />
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      </svg>
    ),
  },
  {
    to: '/updates',
    label: 'Frissítések',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}>
        <polyline points="23 4 23 10 17 10" />
        <polyline points="1 20 1 14 7 14" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
      </svg>
    ),
  },
  {
    to: '/users',
    label: 'Felhasználók',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
]

export function Sidebar() {
  return (
    <aside className="sticky top-0 z-40 hidden h-screen w-[220px] flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-5 md:flex">
      <div className="flex items-center gap-2.5 border-b border-[var(--color-border)] px-1.5 pb-4">
        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-[var(--color-text)] text-[var(--color-bg)] font-bold">
          M
        </div>
        <div>
          <div className="text-[15px] font-semibold leading-tight tracking-tight">
            Marveen
          </div>
          <div className="text-[11px] text-[var(--color-text-muted)]">online</div>
        </div>
      </div>

      <nav className="mt-3.5 flex flex-1 flex-col gap-0.5 overflow-y-auto">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              [
                'flex items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-[var(--color-accent-soft)] text-[var(--color-text)]'
                  : 'text-[var(--color-text-muted)] hover:bg-[var(--color-accent-soft)] hover:text-[var(--color-text)]',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={
                    isActive
                      ? 'text-[var(--color-accent)]'
                      : 'text-current'
                  }
                >
                  {item.icon}
                </span>
                <span className="flex-1">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-3">
        <ThemeToggle />
        <LogoutButton />
      </div>
    </aside>
  )
}
