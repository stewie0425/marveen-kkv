import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { KanbanCard, KanbanPriority, Assignee } from '@/types/api'
import { AssigneePill } from './AssigneePill'

const PRIORITY_BORDER: Record<KanbanPriority, string> = {
  low: 'border-l-[3px] border-l-[var(--color-text-muted)]',
  normal: 'border-l-[3px] border-l-[var(--color-info)]',
  high: 'border-l-[3px] border-l-[#b07c19] dark:border-l-[#e6c275]',
  urgent: 'border-l-[3px] border-l-[var(--color-danger)]',
}

interface Props {
  card: KanbanCard
  assignees: Assignee[]
  onClick: (card: KanbanCard) => void
}

export function KanbanCardItem({ card, assignees, onClick }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: String(card.id) })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const assignee = card.assignee
    ? assignees.find((a) => a.name === card.assignee)
    : null

  let dueLabel: string | null = null
  let overdue = false
  if (card.due_date) {
    const d = new Date(card.due_date * 1000)
    overdue = d < new Date() && card.status !== 'done'
    dueLabel = d.toLocaleDateString('hu-HU', {
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <article
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => {
        // dnd-kit suppresses click during drag; this fires only on a true
        // tap/click, which we forward to the detail modal.
        if (isDragging) return
        onClick(card)
      }}
      className={[
        'group flex cursor-grab flex-col gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-sm)] transition-shadow active:cursor-grabbing',
        PRIORITY_BORDER[card.priority],
        isDragging ? 'shadow-[var(--shadow-md)]' : 'hover:border-[var(--color-accent)]',
      ].join(' ')}
    >
      <div className="text-sm font-medium leading-snug text-[var(--color-text)]">
        {card.title}
      </div>
      {assignee || dueLabel ? (
        <div className="flex items-center justify-between gap-2 text-xs">
          <AssigneePill assignee={assignee} />
          {dueLabel ? (
            <span
              className={[
                'rounded px-1.5 py-0.5 text-[11px] font-medium tabular-nums',
                overdue
                  ? 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]'
                  : 'bg-[var(--color-input)] text-[var(--color-text-muted)]',
              ].join(' ')}
            >
              {dueLabel}
            </span>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}
