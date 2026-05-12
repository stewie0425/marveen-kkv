import type { Incident } from '@/types/api'

// Static service list mirrors the legacy CLAUDE_SERVICES table. The
// "affected" flag is derived from active (non-resolved) incidents whose
// title or description mentions the service keyword.
const SERVICES: Array<{ name: string; label: string }> = [
  { name: 'claude.ai', label: 'Claude.ai' },
  { name: 'api', label: 'Claude API' },
  { name: 'code', label: 'Claude Code' },
  { name: 'platform', label: 'Platform' },
  { name: 'cowork', label: 'Claude Cowork' },
  { name: 'gov', label: 'Claude for Gov' },
]

interface Props {
  incidents: Incident[]
}

export function ServicesGrid({ incidents }: Props) {
  const active = incidents.filter((i) => i.status !== 'resolved')

  return (
    <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]">
      <header className="border-b border-[var(--color-border)] px-4 py-3">
        <h3 className="text-sm font-semibold tracking-tight">Szolgáltatások</h3>
      </header>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-2 px-4 py-3 sm:grid-cols-3">
        {SERVICES.map((svc) => {
          const affected = active.some((i) => {
            const t = i.title.toLowerCase()
            const d = i.description.toLowerCase()
            return t.includes(svc.name) || d.includes(svc.name)
          })
          return (
            <li key={svc.name} className="flex items-center gap-2 text-sm">
              <span
                className={[
                  'h-2 w-2 flex-shrink-0 rounded-full',
                  affected
                    ? 'bg-[var(--color-danger)]'
                    : 'bg-[var(--color-success)]',
                ].join(' ')}
                aria-label={affected ? 'érintett' : 'rendben'}
              />
              <span className="text-[var(--color-text-secondary)]">{svc.label}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
