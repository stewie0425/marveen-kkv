import { useState } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/common/Button'
import { useKanbanAssignees, useKanbanCards } from '@/hooks/useKanban'
import { KanbanBoard } from '@/components/kanban/KanbanBoard'
import { CardEditorModal } from '@/components/kanban/CardEditorModal'
import { CardDetailModal } from '@/components/kanban/CardDetailModal'
import type { KanbanCard, KanbanStatus } from '@/types/api'

export default function KanbanPage() {
  const cards = useKanbanCards()
  const assignees = useKanbanAssignees()

  const [editing, setEditing] = useState<{
    card: KanbanCard | null
    defaultStatus: KanbanStatus | null
  } | null>(null)
  const [detail, setDetail] = useState<KanbanCard | null>(null)

  const newButton = (
    <Button
      variant="primary"
      onClick={() => setEditing({ card: null, defaultStatus: 'planned' })}
      leftIcon={
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      }
    >
      Új kártya
    </Button>
  )

  return (
    <section>
      <PageHeader title="Kanban" subtitle="Feladattábla, kommentekkel." actions={newButton} />

      {cards.isLoading || assignees.isLoading ? (
        <EmptyState>Betöltés…</EmptyState>
      ) : cards.isError ? (
        <EmptyState tone="error">
          {cards.error instanceof Error
            ? cards.error.message
            : 'Nem sikerült betölteni a kártyákat.'}
        </EmptyState>
      ) : (
        <KanbanBoard
          cards={cards.data ?? []}
          assignees={assignees.data ?? []}
          onCardClick={setDetail}
          onAdd={(status) => setEditing({ card: null, defaultStatus: status })}
        />
      )}

      <CardEditorModal
        open={editing !== null}
        onClose={() => setEditing(null)}
        card={editing?.card ?? null}
        defaultStatus={editing?.defaultStatus ?? undefined}
        assignees={assignees.data ?? []}
      />
      <CardDetailModal
        card={detail}
        assignees={assignees.data ?? []}
        onClose={() => setDetail(null)}
        onEdit={(card) => {
          setDetail(null)
          setEditing({ card, defaultStatus: null })
        }}
      />
    </section>
  )
}
