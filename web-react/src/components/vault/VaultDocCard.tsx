import type { VaultDocument } from '@/types/api'
import { formatRelative } from '@/lib/format'

interface Props {
  doc: VaultDocument
  onOpen: (doc: VaultDocument) => void
}

export function VaultDocCard({ doc, onOpen }: Props) {
  const created = new Date(doc.created_at * 1000).toLocaleString('hu-HU')
  const keywords = (doc.keywords ?? []).filter(Boolean)

  return (
    <button
      type="button"
      onClick={() => onOpen(doc)}
      className="group flex w-full flex-col gap-1.5 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-left shadow-[var(--shadow-sm)] transition-colors hover:border-[var(--color-accent)] hover:bg-[var(--color-surface-hover)] focus:border-[var(--color-accent)] focus:outline-none"
    >
      <header className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-[var(--color-info-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-info)]">
          vault
        </span>
        <span className="rounded bg-[var(--color-accent-soft)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--color-accent)]">
          {doc.agent_id}
        </span>
        <span className="ml-auto text-[11px] tabular-nums text-[var(--color-text-muted)]" title={created}>
          {formatRelative(doc.created_at * 1000)}
        </span>
      </header>
      <h3 className="truncate text-sm font-semibold leading-tight text-[var(--color-text)]">
        {doc.title || doc.vault_path || doc.id}
      </h3>
      {doc.snippet ? (
        <p className="line-clamp-2 text-xs leading-snug text-[var(--color-text-secondary)]">
          {doc.snippet}
        </p>
      ) : null}
      {keywords.length > 0 ? (
        <div className="mt-0.5 flex flex-wrap gap-1">
          {keywords.slice(0, 6).map((k) => (
            <span
              key={k}
              className="rounded-full bg-[var(--color-input)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-muted)]"
            >
              {k}
            </span>
          ))}
        </div>
      ) : null}
    </button>
  )
}
