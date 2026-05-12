import { dismissToast, useToasts } from '@/lib/toast'

const TONE_CLASS = {
  info: 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)]',
  success:
    'border-[var(--color-success)] bg-[var(--color-success-soft)] text-[var(--color-success)]',
  error:
    'border-[var(--color-danger)] bg-[var(--color-danger-soft)] text-[var(--color-danger)]',
}

export function ToastContainer() {
  const toasts = useToasts()
  if (!toasts.length) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[300] flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`pointer-events-auto flex max-w-md items-center gap-3 rounded-[var(--radius)] border px-4 py-2 text-sm shadow-[var(--shadow-md)] ${TONE_CLASS[t.tone]}`}
        >
          <span className="flex-1">{t.message}</span>
          <button
            type="button"
            onClick={() => dismissToast(t.id)}
            aria-label="Bezárás"
            className="text-current opacity-70 hover:opacity-100"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}
