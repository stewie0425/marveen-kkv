import type { Assignee } from '@/types/api'

const TYPE_TONE: Record<string, string> = {
  owner: 'bg-[var(--color-accent)] text-white',
  bot: 'bg-[var(--color-info)] text-white',
  agent: 'bg-[var(--color-success)] text-white',
}

interface Props {
  assignee?: Assignee | null
  size?: 'xs' | 'sm'
}

export function AssigneePill({ assignee, size = 'xs' }: Props) {
  if (!assignee) return null
  const tone = TYPE_TONE[assignee.type] ?? 'bg-[var(--color-text-muted)] text-white'
  const dotSize = size === 'sm' ? 'h-5 w-5 text-[10px]' : 'h-4 w-4 text-[9px]'
  const fontSize = size === 'sm' ? 'text-[12px]' : 'text-[11px]'
  return (
    <span className={`inline-flex items-center gap-1.5 ${fontSize} text-[var(--color-text-secondary)]`}>
      <span
        className={`flex flex-shrink-0 items-center justify-center rounded-full font-bold ${tone} ${dotSize}`}
      >
        {assignee.name.charAt(0).toUpperCase()}
      </span>
      <span className="truncate">{assignee.name}</span>
    </span>
  )
}
