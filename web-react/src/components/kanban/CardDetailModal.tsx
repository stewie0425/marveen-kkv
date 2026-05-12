import { useState } from 'react'
import { Modal } from '@/components/common/Modal'
import { Button } from '@/components/common/Button'
import {
  useAddKanbanComment,
  useArchiveKanbanCard,
  useDeleteKanbanCard,
  useKanbanComments,
} from '@/hooks/useKanban'
import { showToast } from '@/lib/toast'
import { AssigneePill } from './AssigneePill'
import type { Assignee, KanbanCard, KanbanPriority, KanbanStatus } from '@/types/api'

const PRIORITY_LABEL: Record<KanbanPriority, string> = {
  low: 'Alacsony',
  normal: 'Normál',
  high: 'Magas',
  urgent: 'Sürgôs',
}

const STATUS_LABEL: Record<KanbanStatus, string> = {
  planned: 'Tervezett',
  in_progress: 'Folyamatban',
  waiting: 'Várakozik',
  done: 'Kész',
}

interface Props {
  card: KanbanCard | null
  assignees: Assignee[]
  onClose: () => void
  onEdit: (card: KanbanCard) => void
}

export function CardDetailModal({ card, assignees, onClose, onEdit }: Props) {
  const open = !!card
  const comments = useKanbanComments(card?.id ?? null)
  const archiveMut = useArchiveKanbanCard()
  const deleteMut = useDeleteKanbanCard()
  const commentMut = useAddKanbanComment()
  // Default author matches BOT_NAME so the assignees dropdown's bot row
  // is preselected and Steve's resolveForwardTarget self-forwards the
  // comment to MAIN_AGENT_ID. A bare "Marveen" no longer matches.
  const [author, setAuthor] = useState('Marveen - The Little Boss')
  const [content, setContent] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (!card) return null

  const assignee = card.assignee
    ? assignees.find((a) => a.name === card.assignee)
    : null

  const submitComment = async () => {
    const c = content.trim()
    if (!c || !author) return
    try {
      const res = await commentMut.mutateAsync({ cardId: card.id, author, content: c })
      setContent('')
      const forwarded = (res as { forwarded?: { id: number; to: string } | null })
        ?.forwarded
      if (forwarded?.to) {
        showToast(`Elküldve ${forwarded.to}-nek`, 'success')
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Komment hiba', 'error')
    }
  }

  const archive = async () => {
    try {
      await archiveMut.mutateAsync(card.id)
      showToast('Kártya archiválva', 'success')
      onClose()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Archiválás hiba', 'error')
    }
  }

  const remove = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    try {
      await deleteMut.mutateAsync(card.id)
      showToast('Kártya törölve', 'success')
      onClose()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Törlés hiba', 'error')
    }
  }

  const dueLabel = card.due_date
    ? new Date(card.due_date * 1000).toLocaleDateString('hu-HU')
    : '—'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={card.title}
      size="md"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={remove}
              disabled={deleteMut.isPending}
              className="text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]"
            >
              {confirmDelete ? 'Tényleg töröljem? Kattints újra' : 'Törlés'}
            </Button>
            <Button onClick={archive} disabled={archiveMut.isPending}>
              Archiválás
            </Button>
          </div>
          <Button variant="primary" onClick={() => onEdit(card)}>
            Szerkesztés
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <Meta label="Állapot">{STATUS_LABEL[card.status]}</Meta>
          <Meta label="Prioritás">{PRIORITY_LABEL[card.priority]}</Meta>
          <Meta label="Felelôs">
            {assignee ? <AssigneePill assignee={assignee} size="sm" /> : '—'}
          </Meta>
          <Meta label="Határidô">{dueLabel}</Meta>
        </dl>

        {card.description ? (
          <div className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">
            {card.description}
          </div>
        ) : null}

        <section>
          <h4 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
            Megjegyzések
          </h4>
          {comments.isLoading ? (
            <p className="text-sm text-[var(--color-text-muted)]">Betöltés…</p>
          ) : comments.data && comments.data.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {comments.data.map((c, i) => (
                <li
                  key={c.id ?? i}
                  className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
                >
                  <div className="flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
                    <span className="font-medium text-[var(--color-text-secondary)]">
                      {c.author}
                    </span>
                    <span className="tabular-nums">
                      {new Date(c.created_at * 1000).toLocaleString('hu-HU')}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-[var(--color-text-secondary)]">
                    {c.content}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)]">
              Nincs megjegyzés.
            </p>
          )}

          <div className="mt-3 flex flex-col gap-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
              <select
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none sm:w-44"
              >
                {assignees.map((a) => (
                  <option key={a.name} value={a.name}>
                    {a.name}
                  </option>
                ))}
              </select>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={2}
                placeholder="Új megjegyzés…"
                className="flex-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none"
              />
            </div>
            <div className="flex justify-end">
              <Button
                variant="primary"
                size="sm"
                onClick={submitComment}
                disabled={!content.trim() || commentMut.isPending}
              >
                {commentMut.isPending ? 'Küldés…' : 'Küldés'}
              </Button>
            </div>
          </div>
        </section>
      </div>
    </Modal>
  )
}

function Meta({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
        {label}
      </dt>
      <dd className="text-[var(--color-text-secondary)]">{children}</dd>
    </div>
  )
}
