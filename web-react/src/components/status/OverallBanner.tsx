import type { OverallStatus } from '@/types/api'

const LABEL: Record<string, string> = {
  operational: 'Minden szolgáltatás mûködik',
  degraded: 'Aktív incidens',
  unknown: 'Státusz nem elérhetô',
}

const TONE: Record<string, string> = {
  operational:
    'border-[var(--color-success)] bg-[var(--color-success-soft)] text-[var(--color-success)]',
  degraded:
    'border-[var(--color-danger)] bg-[var(--color-danger-soft)] text-[var(--color-danger)]',
  unknown:
    'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)]',
}

interface Props {
  overall: OverallStatus
}

export function OverallBanner({ overall }: Props) {
  const tone = TONE[overall] ?? TONE.unknown
  const label = LABEL[overall] ?? overall
  return (
    <div
      className={`flex items-center gap-3 rounded-[var(--radius)] border px-4 py-3 text-sm font-medium ${tone}`}
    >
      <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full bg-current" />
      {label}
    </div>
  )
}
