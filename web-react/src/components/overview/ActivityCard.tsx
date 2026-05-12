import type { OverviewActivity } from '@/types/api'
import { formatRelative } from '@/lib/format'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2 }

const ICONS: Record<string, React.ReactNode> = {
  delegate: (
    <svg width="16" height="16" viewBox="0 0 24 24" {...stroke}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  ),
  memory: (
    <svg width="16" height="16" viewBox="0 0 24 24" {...stroke}>
      <path d="M12 3C7.5 3 4 6.5 4 11v4l-2 3h4v2a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3v-2h4l-2-3v-4c0-4.5-3.5-8-8-8z" />
    </svg>
  ),
}

interface Props {
  activity: OverviewActivity[]
}

export function ActivityCard({ activity }: Props) {
  return (
    <article className="flex flex-col rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]">
      <header className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
        <h3 className="text-sm font-semibold tracking-tight">Aktivitás</h3>
      </header>
      {activity.length === 0 ? (
        <div className="px-4 py-6 text-sm text-[var(--color-text-muted)]">
          Nincs friss esemény.
        </div>
      ) : (
        <ul className="flex max-h-[420px] flex-col divide-y divide-[var(--color-border)] overflow-y-auto">
          {activity.map((a, i) => (
            <li key={i} className="flex items-start gap-3 px-4 py-2.5">
              <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
                {ICONS[a.icon] ?? ICONS.delegate}
              </span>
              <div className="min-w-0 flex-1">
                <div className="break-words text-sm leading-snug text-[var(--color-text-secondary)]">
                  {a.text}
                </div>
                <div className="mt-0.5 text-[11px] tabular-nums text-[var(--color-text-muted)]">
                  {formatRelative(a.at)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}
