import type { AgentSummary } from '@/types/api'
import { Avatar } from '@/components/common/Avatar'

interface Props {
  agent: AgentSummary
  onSelect: (name: string) => void
}

function modelLabel(model: string): string {
  if (!model || model === 'inherit') return 'inherit'
  if (model.includes('opus')) return 'opus'
  if (model.includes('sonnet')) return 'sonnet'
  if (model.includes('haiku')) return 'haiku'
  return model
}

export function AgentCard({ agent, onSelect }: Props) {
  const label = agent.displayName || agent.name
  const avatarUrl = agent.hasAvatar
    ? `/api/agents/${encodeURIComponent(agent.name)}/avatar`
    : null
  const isRunning = agent.running
  const tg = agent.hasTelegram

  return (
    <button
      type="button"
      onClick={() => onSelect(agent.name)}
      className="flex flex-col gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-left shadow-[var(--shadow-sm)] transition-[border-color,box-shadow] duration-200 hover:border-[var(--color-accent)] hover:shadow-[var(--shadow-md)]"
    >
      <div className="flex items-start gap-3">
        <Avatar src={avatarUrl} name={label} size={44} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-[var(--color-text)]">
            {label}
          </div>
          <div className="line-clamp-2 mt-1 text-[13px] leading-snug text-[var(--color-text-muted)]">
            {agent.description}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-border)] pt-3 text-[11px]">
        <span className="rounded bg-[var(--color-accent-soft)] px-1.5 py-0.5 font-semibold uppercase tracking-wider text-[var(--color-accent)]">
          {modelLabel(agent.model)}
        </span>
        <span className="inline-flex items-center gap-1 text-[var(--color-text-muted)]">
          <span
            className={[
              'h-1.5 w-1.5 rounded-full',
              isRunning
                ? 'bg-[var(--color-success)]'
                : 'bg-[var(--color-text-muted)]',
            ].join(' ')}
          />
          {isRunning ? 'Fut' : 'Leállva'}
        </span>
        <span className="inline-flex items-center gap-1 text-[var(--color-text-muted)]">
          <span
            className={[
              'h-1.5 w-1.5 rounded-full',
              tg
                ? 'bg-[var(--color-info)]'
                : 'bg-[var(--color-text-muted)] opacity-50',
            ].join(' ')}
          />
          {tg ? 'Telegram' : 'no TG'}
        </span>
      </div>
    </button>
  )
}
