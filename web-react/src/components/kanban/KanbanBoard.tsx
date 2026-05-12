import { useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import type {
  Assignee,
  KanbanCard,
  KanbanStatus,
} from '@/types/api'
import { KanbanColumn } from './KanbanColumn'
import { KanbanCardItem } from './KanbanCard'
import { useMoveKanbanCard } from '@/hooks/useKanban'
import { showToast } from '@/lib/toast'

const COLUMNS: Array<{ status: KanbanStatus; title: string }> = [
  { status: 'planned', title: 'Tervezett' },
  { status: 'in_progress', title: 'Folyamatban' },
  { status: 'waiting', title: 'Várakozik' },
  { status: 'done', title: 'Kész' },
]

interface Props {
  cards: KanbanCard[]
  assignees: Assignee[]
  onCardClick: (card: KanbanCard) => void
  onAdd: (status: KanbanStatus) => void
}

export function KanbanBoard({ cards, assignees, onCardClick, onAdd }: Props) {
  const moveMut = useMoveKanbanCard()
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const grouped = useMemo(() => {
    const map: Record<KanbanStatus, KanbanCard[]> = {
      planned: [],
      in_progress: [],
      waiting: [],
      done: [],
    }
    for (const c of cards) {
      if (map[c.status]) map[c.status].push(c)
    }
    for (const s of Object.keys(map) as KanbanStatus[]) {
      map[s].sort((a, b) => a.sort_order - b.sort_order)
    }
    return map
  }, [cards])

  const activeCard = activeId
    ? cards.find((c) => String(c.id) === activeId) ?? null
    : null

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id))

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = e
    if (!over) return
    const card = cards.find((c) => String(c.id) === String(active.id))
    if (!card) return

    // Determine target status: if dropped on a column id (one of COLUMNS),
    // append to its end; if dropped on another card, take that card's status
    // and slot before it.
    const overId = String(over.id)
    const isColumn = COLUMNS.some((c) => c.status === overId)
    let targetStatus: KanbanStatus
    let sortOrder: number

    if (isColumn) {
      targetStatus = overId as KanbanStatus
      sortOrder = grouped[targetStatus].filter((c) => c.id !== card.id).length
    } else {
      const overCard = cards.find((c) => String(c.id) === overId)
      if (!overCard) return
      targetStatus = overCard.status
      const list = grouped[targetStatus].filter((c) => c.id !== card.id)
      const idx = list.findIndex((c) => c.id === overCard.id)
      sortOrder = idx >= 0 ? idx : list.length
    }

    if (
      targetStatus === card.status &&
      sortOrder === card.sort_order
    ) {
      return
    }

    moveMut.mutate(
      { id: card.id, status: targetStatus, sort_order: sortOrder },
      {
        onError: () => showToast('Hiba az áthelyezés során', 'error'),
      },
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.status}
            status={col.status}
            title={col.title}
            cards={grouped[col.status]}
            assignees={assignees}
            onCardClick={onCardClick}
            onAdd={onAdd}
            canAdd={col.status !== 'done'}
          />
        ))}
      </div>
      <DragOverlay>
        {activeCard ? (
          <div className="opacity-90">
            <KanbanCardItem
              card={activeCard}
              assignees={assignees}
              onClick={() => {}}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
