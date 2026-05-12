interface Props {
  children: React.ReactNode
  tone?: 'default' | 'error'
  className?: string
}

export function EmptyState({ children, tone = 'default', className = '' }: Props) {
  const toneClass =
    tone === 'error'
      ? 'border-[var(--color-danger)] bg-[var(--color-danger-soft)] text-[var(--color-danger)]'
      : 'border-dashed border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)]'
  return (
    <div
      className={`rounded-[var(--radius)] border p-8 text-center text-sm ${toneClass} ${className}`}
    >
      {children}
    </div>
  )
}
