import type { ScheduleAgent, ScheduleTask } from '@/types/api'
import { Avatar } from '@/components/common/Avatar'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2 }

interface Props {
  task: ScheduleTask
  agents: ScheduleAgent[]
  onEdit: (task: ScheduleTask) => void
  onToggle: (task: ScheduleTask) => void
  onDelete: (task: ScheduleTask) => void
  isPending?: boolean
}

export function ScheduleRow({
  task,
  agents,
  onEdit,
  onToggle,
  onDelete,
  isPending,
}: Props) {
  const agent = agents.find((a) => a.name === task.agent)
  const agentLabel = agent?.label || task.agent
  const isActive = task.enabled

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onEdit(task)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onEdit(task)
        }
      }}
      className="flex cursor-pointer items-center gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 shadow-[var(--shadow-sm)] transition-[border-color,box-shadow] hover:border-[var(--color-accent)] hover:shadow-[var(--shadow-md)]"
    >
      <Avatar src={agent?.avatar ?? null} name={agentLabel} size={32} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium text-[var(--color-text)]">
            {task.description || task.name}
          </span>
          {task.type === 'heartbeat' ? (
            <span className="rounded-full bg-[var(--color-info-soft)] px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[var(--color-info)]">
              heartbeat
            </span>
          ) : null}
          <span
            className={[
              'rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide',
              isActive
                ? 'bg-[var(--color-success-soft)] text-[var(--color-success)]'
                : 'bg-[rgba(120,120,120,0.14)] text-[var(--color-text-muted)]',
            ].join(' ')}
          >
            {isActive ? 'aktív' : 'szünet'}
          </span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-[var(--color-text-muted)]">
          <span className="font-mono text-[var(--color-text-secondary)]">
            {task.schedule}
          </span>
          <span>{agentLabel}</span>
          <span className="font-mono">{task.name}</span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={isActive ? 'Szüneteltetés' : 'Folytatás'}
          disabled={isPending}
          onClick={(e) => {
            e.stopPropagation()
            onToggle(task)
          }}
          className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)] disabled:opacity-50"
        >
          {isActive ? (
            <svg width="14" height="14" viewBox="0 0 24 24" {...stroke}>
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" {...stroke}>
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          )}
        </button>
        <button
          type="button"
          aria-label="Törlés"
          disabled={isPending}
          onClick={(e) => {
            e.stopPropagation()
            onDelete(task)
          }}
          className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)] disabled:opacity-50"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" {...stroke}>
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
        </button>
      </div>
    </div>
  )
}
