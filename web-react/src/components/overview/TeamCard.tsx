import type { OverviewTeamMember } from '@/types/api'

interface Props {
  team: OverviewTeamMember[]
}

// Phase 2 simplification: flat list with avatars and a running indicator.
// The full hierarchical reports-to graph lives on the Csapat page (Phase 3+).
export function TeamCard({ team }: Props) {
  return (
    <article className="flex flex-col rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]">
      <header className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
        <h3 className="text-sm font-semibold tracking-tight">Csapat</h3>
        <span className="text-xs text-[var(--color-text-muted)]">élő állapot</span>
      </header>
      <ul className="flex flex-col divide-y divide-[var(--color-border)]">
        {team.map((m) => (
          <li
            key={m.id}
            className="flex items-center gap-3 px-4 py-2.5"
          >
            <img
              src={m.avatarUrl}
              alt=""
              loading="lazy"
              onError={(e) => {
                ;(e.currentTarget as HTMLImageElement).style.visibility = 'hidden'
              }}
              className="h-7 w-7 flex-shrink-0 rounded-full bg-[var(--color-input)] object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-[var(--color-text)]">
                {m.label}
              </div>
              <div className="truncate font-mono text-[11px] text-[var(--color-text-muted)]">
                {m.id}
              </div>
            </div>
            <span
              className={[
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                m.role === 'main'
                  ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                  : 'bg-[rgba(120,120,120,0.12)] text-[var(--color-text-muted)]',
              ].join(' ')}
            >
              {m.role}
            </span>
            <span
              className={[
                'h-2 w-2 flex-shrink-0 rounded-full',
                m.running
                  ? 'bg-[var(--color-success)]'
                  : 'bg-[var(--color-text-muted)] opacity-50',
              ].join(' ')}
              title={m.running ? 'fut' : 'leállítva'}
            />
          </li>
        ))}
      </ul>
    </article>
  )
}
