import type { PaneState, SessionInfo } from '@/types/api'
import { formatDuration } from '@/lib/format'

type DisplayState = PaneState | 'stopped'

interface BadgeStyle {
  bg: string
  text: string
  darkBg?: string
  darkText?: string
  pulse?: boolean
}

const BADGE_STYLES: Record<DisplayState, BadgeStyle> = {
  idle: {
    bg: 'bg-[var(--color-success-soft)]',
    text: 'text-[var(--color-success)]',
  },
  busy: {
    bg: 'bg-[rgba(217,165,32,0.16)]',
    text: 'text-[#b07c19]',
    darkBg: 'dark:bg-[rgba(217,165,32,0.22)]',
    darkText: 'dark:text-[#e6c275]',
    pulse: true,
  },
  typing: {
    bg: 'bg-[var(--color-info-soft)]',
    text: 'text-[var(--color-info)]',
  },
  unknown: {
    bg: 'bg-[rgba(120,120,120,0.14)]',
    text: 'text-[var(--color-text-muted)]',
  },
  stopped: {
    bg: 'bg-[rgba(120,120,120,0.10)]',
    text: 'text-[var(--color-text-muted)]',
  },
}

const STATE_LABELS: Record<DisplayState, string> = {
  idle: 'Idle',
  busy: 'Busy',
  typing: 'Typing',
  unknown: 'Unknown',
  stopped: 'Stopped',
}

function getDisplayState(s: SessionInfo): DisplayState {
  if (!s.running) return 'stopped'
  return s.paneState ?? 'unknown'
}

function getTimerLabel(s: SessionInfo): string | null {
  if (!s.running) return null
  if (s.paneState === 'busy' && s.busyForMs != null)
    return `Busy ${formatDuration(s.busyForMs)}`
  if (s.paneState === 'idle' && s.sinceMs != null)
    return `Idle ${formatDuration(s.sinceMs)}`
  if (s.paneState === 'typing' && s.sinceMs != null)
    return `Typing ${formatDuration(s.sinceMs)}`
  return null
}

interface BadgeProps {
  state: DisplayState
}

function StatusBadge({ state }: BadgeProps) {
  const style = BADGE_STYLES[state]
  const dotClass = style.pulse
    ? 'session-pulse h-1.5 w-1.5 rounded-full bg-current [animation:session-pulse_1.4s_ease-in-out_infinite]'
    : 'h-1.5 w-1.5 rounded-full bg-current'
  const classes = [
    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide',
    style.bg,
    style.text,
    style.darkBg ?? '',
    style.darkText ?? '',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <span className={classes}>
      <span className={dotClass} />
      {STATE_LABELS[state]}
    </span>
  )
}

interface PreviewProps {
  lines: string[]
  running: boolean
}

function Preview({ lines, running }: PreviewProps) {
  if (!lines.length) {
    return (
      <div className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-code)] px-3 py-2.5 text-xs italic text-[var(--color-text-muted)]">
        {running ? 'Nincs aktuális kimenet' : 'Az ágens nem fut'}
      </div>
    )
  }
  return (
    <div
      className="max-h-[180px] overflow-y-auto rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-code)] px-3 py-2.5 font-mono text-[11.5px] leading-snug text-[var(--color-text-secondary)]"
      style={{ whiteSpace: 'pre' }}
    >
      {lines.map((line, i) => (
        <div key={i} className="overflow-hidden text-ellipsis whitespace-pre">
          {line}
        </div>
      ))}
    </div>
  )
}

interface Props {
  session: SessionInfo
}

export function SessionCard({ session }: Props) {
  const state = getDisplayState(session)
  const timer = getTimerLabel(session)
  const isBusy = state === 'busy'

  return (
    <article className="flex flex-col gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 shadow-[var(--shadow-sm)] transition-[border-color,box-shadow] duration-200 hover:border-[var(--color-accent)] hover:shadow-[var(--shadow-md)]">
      <header className="flex items-center gap-3">
        <img
          src={session.avatar}
          alt=""
          loading="lazy"
          onError={(e) => {
            ;(e.currentTarget as HTMLImageElement).style.visibility = 'hidden'
          }}
          className="h-9 w-9 flex-shrink-0 rounded-full bg-[var(--color-input)] object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-[var(--color-text)]">
              {session.displayName || session.name}
            </span>
            {session.role === 'main' ? (
              <span className="rounded bg-[var(--color-accent-soft)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-accent)]">
                main
              </span>
            ) : null}
          </div>
          <div className="truncate font-mono text-[11px] text-[var(--color-text-muted)]">
            {session.name}
          </div>
        </div>
        <div className="flex flex-shrink-0 flex-col items-end gap-1">
          <StatusBadge state={state} />
          {timer ? (
            <span
              className={[
                'tabular-nums text-[11px]',
                isBusy
                  ? 'font-medium text-[#b07c19] dark:text-[#e6c275]'
                  : 'text-[var(--color-text-muted)]',
              ].join(' ')}
            >
              {timer}
            </span>
          ) : null}
        </div>
      </header>
      <Preview lines={session.preview} running={session.running} />
    </article>
  )
}
