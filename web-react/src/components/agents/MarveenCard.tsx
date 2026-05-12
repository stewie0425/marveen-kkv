import type { MarveenInfo } from '@/types/api'
import { Avatar } from '@/components/common/Avatar'

interface Props {
  marveen: MarveenInfo
  onSelect: () => void
}

export function MarveenCard({ marveen, onSelect }: Props) {
  const label = marveen.name || 'Marveen'
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex flex-col gap-3 rounded-[var(--radius)] border border-[var(--color-accent)] bg-[var(--color-accent-soft)] p-4 text-left shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-md)]"
    >
      <div className="flex items-start gap-3">
        <Avatar src="/api/marveen/avatar" name={label} size={44} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-[var(--color-text)]">
              {label}
            </span>
            <span className="rounded bg-[var(--color-accent)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
              fô asszisztens
            </span>
          </div>
          <div className="line-clamp-2 mt-1 text-[13px] leading-snug text-[var(--color-text-secondary)]">
            {marveen.description || ''}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-accent)]/30 pt-3 text-[11px] text-[var(--color-text-secondary)]">
        <span className="rounded bg-[var(--color-accent)] px-1.5 py-0.5 font-semibold uppercase tracking-wider text-white">
          opus
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-success)]" />
          Fut
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-info)]" />
          {marveen.hasTelegram ? 'Online' : 'no TG'}
        </span>
      </div>
    </button>
  )
}
