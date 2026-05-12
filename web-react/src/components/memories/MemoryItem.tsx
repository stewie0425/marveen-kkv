import type { Memory, MemoryTier } from '@/types/api'

const TIER_BADGE: Record<string, string> = {
  hot: 'bg-[rgba(220,60,60,0.12)] text-[#dc3c3c] dark:bg-[rgba(220,60,60,0.2)] dark:text-[#f08a8a]',
  warm: 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]',
  cold: 'bg-[var(--color-info-soft)] text-[var(--color-info)]',
  shared:
    'bg-[rgba(200,180,100,0.18)] text-[#9a8a30] dark:bg-[rgba(200,180,100,0.2)] dark:text-[#d8c87a]',
}

interface Props {
  memory: Memory
  onEdit: (m: Memory) => void
  onDelete: (m: Memory) => void
}

export function MemoryItem({ memory, onEdit, onDelete }: Props) {
  const tier = memory.category as MemoryTier
  const tierClass = TIER_BADGE[tier] ?? 'bg-[var(--color-input)] text-[var(--color-text-muted)]'
  const created = memory.created_label ||
    new Date(memory.created_at * 1000).toLocaleString('hu-HU')

  return (
    <article className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 shadow-[var(--shadow-sm)]">
      <header className="mb-1.5 flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tierClass}`}
        >
          {tier}
        </span>
        <span className="rounded bg-[var(--color-accent-soft)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--color-accent)]">
          {memory.agent_id}
        </span>
        {memory.auto_generated ? (
          <span className="rounded bg-[var(--color-input)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-muted)]">
            auto
          </span>
        ) : null}
        <span className="ml-auto text-[11px] tabular-nums text-[var(--color-text-muted)]">
          {created}
        </span>
      </header>
      <p className="whitespace-pre-wrap text-sm leading-snug text-[var(--color-text-secondary)]">
        {memory.content}
      </p>
      {memory.keywords ? (
        <div className="mt-2 text-[11px] text-[var(--color-text-muted)]">
          🏷 {memory.keywords}
        </div>
      ) : null}
      <div className="mt-2 flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={() => onEdit(memory)}
          className="rounded-[var(--radius-sm)] px-2 py-1 text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"
        >
          Szerkesztés
        </button>
        <button
          type="button"
          onClick={() => onDelete(memory)}
          className="rounded-[var(--radius-sm)] px-2 py-1 text-xs text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]"
        >
          Törlés
        </button>
      </div>
    </article>
  )
}
