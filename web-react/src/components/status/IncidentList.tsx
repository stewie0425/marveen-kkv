import type { Incident, IncidentStatus } from '@/types/api'
import { formatIncidentDate } from '@/lib/format'

const STATUS_LABEL: Record<string, string> = {
  resolved: 'Megoldva',
  monitoring: 'Figyelés',
  identified: 'Azonosítva',
  investigating: 'Vizsgálat',
}

const STATUS_TONE: Record<string, string> = {
  resolved:
    'bg-[var(--color-success-soft)] text-[var(--color-success)]',
  monitoring:
    'bg-[var(--color-info-soft)] text-[var(--color-info)]',
  identified:
    'bg-[rgba(217,165,32,0.16)] text-[#b07c19] dark:bg-[rgba(217,165,32,0.22)] dark:text-[#e6c275]',
  investigating:
    'bg-[var(--color-danger-soft)] text-[var(--color-danger)]',
}

function statusBadge(status: IncidentStatus) {
  const tone = STATUS_TONE[status] ?? 'bg-[rgba(120,120,120,0.14)] text-[var(--color-text-muted)]'
  const label = STATUS_LABEL[status] ?? status
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide ${tone}`}
    >
      {label}
    </span>
  )
}

interface Props {
  incidents: Incident[]
}

export function IncidentList({ incidents }: Props) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]">
      <header className="border-b border-[var(--color-border)] px-4 py-3">
        <h3 className="text-sm font-semibold tracking-tight">Incidensek</h3>
      </header>
      {incidents.length === 0 ? (
        <div className="px-4 py-6 text-sm text-[var(--color-text-muted)]">
          Nincs korábbi incidens.
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--color-border)]">
          {incidents.map((inc, i) => (
            <li key={i} className="flex flex-col gap-1.5 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <a
                  href={inc.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-sm font-medium text-[var(--color-text)] hover:text-[var(--color-accent)]"
                >
                  {inc.title}
                </a>
                {statusBadge(inc.status)}
              </div>
              <p className="line-clamp-3 text-[13px] leading-snug text-[var(--color-text-secondary)]">
                {inc.description.length > 300
                  ? inc.description.slice(0, 300) + '…'
                  : inc.description}
              </p>
              <div className="text-[11px] tabular-nums text-[var(--color-text-muted)]">
                {formatIncidentDate(inc.pubDate)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
