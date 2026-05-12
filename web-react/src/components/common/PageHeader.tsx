interface Props {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

// Shared chrome for every page so titles, subtitles and right-side
// actions render with the same vertical rhythm.
export function PageHeader({ title, subtitle, actions }: Props) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-[var(--color-border)] pb-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? (
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  )
}
