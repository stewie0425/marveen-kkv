import { useState } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/common/Button'
import {
  useDeleteSchedule,
  usePendingRetries,
  useScheduleAgents,
  useSchedules,
  useToggleSchedule,
} from '@/hooks/useSchedules'
import { ScheduleRow } from '@/components/schedules/ScheduleRow'
import { ScheduleEditorModal } from '@/components/schedules/ScheduleEditorModal'
import { PendingRetriesBanner } from '@/components/schedules/PendingRetriesBanner'
import { showToast } from '@/lib/toast'
import type { ScheduleTask } from '@/types/api'

export default function SchedulesPage() {
  const tasks = useSchedules()
  const agents = useScheduleAgents()
  const pending = usePendingRetries()
  const toggleMut = useToggleSchedule()
  const deleteMut = useDeleteSchedule()

  const [editing, setEditing] = useState<ScheduleTask | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const onToggle = async (t: ScheduleTask) => {
    try {
      await toggleMut.mutateAsync(t.name)
      showToast(t.enabled ? 'Feladat szüneteltetve' : 'Feladat újraindult', 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Hiba', 'error')
    }
  }

  const onDelete = async (t: ScheduleTask) => {
    if (!confirm(`Töröljem a(z) "${t.name}" feladatot?`)) return
    try {
      await deleteMut.mutateAsync(t.name)
      showToast('Feladat törölve', 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Hiba', 'error')
    }
  }

  const newButton = (
    <Button
      variant="primary"
      onClick={() => setCreateOpen(true)}
      leftIcon={
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      }
    >
      Új feladat
    </Button>
  )

  return (
    <section>
      <PageHeader
        title="Ütemezések"
        subtitle="Idôzített feladatok kezelése"
        actions={newButton}
      />

      <PendingRetriesBanner retries={pending.data ?? []} />

      {tasks.isLoading ? (
        <EmptyState>Betöltés…</EmptyState>
      ) : tasks.isError ? (
        <EmptyState tone="error">
          {tasks.error instanceof Error
            ? tasks.error.message
            : 'Nem sikerült betölteni a feladatokat.'}
        </EmptyState>
      ) : tasks.data && tasks.data.length > 0 ? (
        <div className="flex flex-col gap-2">
          {tasks.data.map((t) => (
            <ScheduleRow
              key={t.name}
              task={t}
              agents={agents.data ?? []}
              onEdit={setEditing}
              onToggle={onToggle}
              onDelete={onDelete}
              isPending={toggleMut.isPending || deleteMut.isPending}
            />
          ))}
        </div>
      ) : (
        <EmptyState>Nincsenek ütemezett feladatok.</EmptyState>
      )}

      <ScheduleEditorModal
        open={createOpen || editing !== null}
        onClose={() => {
          setCreateOpen(false)
          setEditing(null)
        }}
        task={editing}
        agents={agents.data ?? []}
      />
    </section>
  )
}
