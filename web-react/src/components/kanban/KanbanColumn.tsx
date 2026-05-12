import { useDroppable } from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import type { Assignee, KanbanCard, KanbanStatus } from '@/types/api'
import { KanbanCardItem } from './KanbanCard'

interface Props {
  status: KanbanStatus
  title: string
  cards: KanbanCard[]
  assignees: Assignee[]
  onCardClick: (card: KanbanCard) => void
  onAdd: (status: KanbanStatus) => void
  canAdd: boolean
}

export function KanbanColumn({
  status,
  title,
  cards,
  assignees,
  onCardClick,
  onAdd,
  canAdd,
}: Props) {
  // The column body is the drop zone for cross-column moves; the cards
  // inside register as sortable items via SortableContext.
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const ids = cards.map((c) => String(c.id))

  return (
    <section
      className={[
        'flex w-full min-w-[260px] flex-shrink-0 flex-col rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)] transition-colors',
        isOver ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]/40' : '',
      ].join(' ')}
    >
      <header className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold tracking-tight">{title}</span>
          <span className="rounded-full bg-[var(--color-input)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-text-muted)]">
            {cards.length}
          </span>
        </div>
        {canAdd ? (
          <button
            type="button"
            onClick={() => onAdd(status)}
            aria-label="Új kártya"
            className="flex h-6 w-6 items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-accent-soft)] hover:text-[var(--color-accent)]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        ) : null}
      </header>

      <div
        ref={setNodeRef}
        className="flex flex-1 flex-col gap-2 p-3 min-h-[120px]"
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {cards.map((c) => (
            <KanbanCardItem
              key={c.id}
              card={c}
              assignees={assignees}
              onClick={onCardClick}
            />
          ))}
        </SortableContext>
        {cards.length === 0 ? (
          <div className="rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border)] py-6 text-center text-xs text-[var(--color-text-muted)]">
            Üres
          </div>
        ) : null}
      </div>
    </section>
  )
}
