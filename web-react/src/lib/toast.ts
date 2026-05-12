// Tiny module-state toast bus. No external deps; the ToastContainer
// subscribes to changes and re-renders. Each toast auto-dismisses after
// 3.5s unless the caller opts out.

import { useSyncExternalStore } from 'react'

export type ToastTone = 'info' | 'success' | 'error'

export interface Toast {
  id: number
  message: string
  tone: ToastTone
}

let nextId = 1
let toasts: Toast[] = []
const listeners = new Set<() => void>()

function emit() {
  for (const fn of listeners) fn()
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function getSnapshot(): Toast[] {
  return toasts
}

function getServerSnapshot(): Toast[] {
  return []
}

export function showToast(
  message: string,
  tone: ToastTone = 'info',
  durationMs = 3500,
): number {
  const id = nextId++
  toasts = [...toasts, { id, message, tone }]
  emit()
  if (durationMs > 0) {
    setTimeout(() => dismissToast(id), durationMs)
  }
  return id
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
