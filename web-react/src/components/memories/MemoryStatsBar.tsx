import type { MemoryStats } from '@/types/api'
import { formatNumber } from '@/lib/format'

const TIER_LABEL: Record<string, string> = {
  hot: 'Hot',
  warm: 'Warm',
  cold: 'Cold',
  shared: 'Shared',
}

const TIER_TONE: Record<string, string> = {
  hot: 'text-[#dc3c3c]',
  warm: 'text-[var(--color-accent)]',
  cold: 'text-[var(--color-info)]',
  shared: 'text-[#9a8a30] dark:text-[#d8c87a]',
}

interface Props {
  stats: MemoryStats | undefined
}

export function MemoryStatsBar({ stats }: Props) {
  if (!stats) return null
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
      <Tile label="Összesen" value={formatNumber(stats.total)} />
      {(['hot', 'warm', 'cold', 'shared'] as const).map((t) => (
        <Tile
          key={t}
          label={TIER_LABEL[t]}
          value={formatNumber(stats.byTier?.[t] ?? 0)}
          tone={TIER_TONE[t]}
        />
      ))}
    </div>
  )
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string
  value: string | number
  tone?: string
}) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 shadow-[var(--shadow-sm)]">
      <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
        {label}
      </div>
      <div
        className={`text-xl font-semibold tabular-nums ${tone ?? 'text-[var(--color-text)]'}`}
      >
        {value}
      </div>
    </div>
  )
}
