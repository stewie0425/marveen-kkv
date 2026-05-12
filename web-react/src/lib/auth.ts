// Module-state auth store. Same subscribe pattern as the toast bus so the
// apiFetch wrapper can flip the app to 'unauthenticated' on a 401 without
// importing React. The AuthGate in App.tsx and the Sidebar logout button
// read the same state via useSyncExternalStore.

import { useSyncExternalStore } from 'react'

export type AuthStatus = 'pending' | 'authenticated' | 'unauthenticated'

let status: AuthStatus = 'pending'
const listeners = new Set<() => void>()

function emit() {
  for (const fn of listeners) fn()
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function getSnapshot(): AuthStatus {
  return status
}

export function getAuthStatus(): AuthStatus {
  return status
}

export function setAuthStatus(s: AuthStatus): void {
  if (s === status) return
  status = s
  emit()
}

export function useAuthStatus(): AuthStatus {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
