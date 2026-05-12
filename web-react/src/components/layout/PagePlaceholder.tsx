interface Props {
  title: string
  subtitle?: string
}

// Phase 0 stub. Each route gets a real implementation in later phases;
// for now we render the page chrome so navigation, layout and theming
// can be reviewed in isolation.
export function PagePlaceholder({ title, subtitle }: Props) {
  return (
    <section>
      <header className="mb-6 border-b border-[var(--color-border)] pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? (
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">{subtitle}</p>
        ) : null}
      </header>
      <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-10 text-center text-sm text-[var(--color-text-muted)]">
        Phase 0 placeholder. A tényleges oldal a parity-fázisokban kerül implementálásra.
      </div>
    </section>
  )
}
