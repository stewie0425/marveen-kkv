interface Props {
  label: string
  value: string | number | null | undefined
  sub?: string | null
}

export function StatTile({ label, value, sub }: Props) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3.5 shadow-[var(--shadow-sm)]">
      <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-[var(--color-text)]">
        {value ?? '—'}
      </div>
      {sub ? (
        <div className="mt-0.5 text-xs text-[var(--color-text-muted)]">{sub}</div>
      ) : null}
    </div>
  )
}
