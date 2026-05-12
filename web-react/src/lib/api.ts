// Auth flow:
//   - Backward-compat URL bootstrap: a one-time ?token=XXX paste persists
//     to localStorage and the URL is cleaned.
//   - apiFetch() injects the stored Bearer on every same-origin /api/*
//     call. A 401 wipes the token and flips the app's auth state to
//     'unauthenticated', which surfaces the LoginScreen — no more alert
//     dialogs.
//   - validateToken() pings /api/auth/status to confirm a token is still
//     accepted. Used by AuthGate on mount and by LoginScreen on submit.

import { setAuthStatus } from './auth'

const TOKEN_KEY = 'marveen-dashboard-token'

export function bootstrapAuth(): void {
  const params = new URLSearchParams(window.location.search)
  const urlToken = params.get('token')
  if (urlToken) {
    localStorage.setItem(TOKEN_KEY, urlToken)
    params.delete('token')
    const clean =
      window.location.pathname +
      (params.toString() ? '?' + params : '') +
      window.location.hash
    window.history.replaceState({}, '', clean)
  }
}

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setAuthToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

function isApiUrl(url: string): boolean {
  if (url.startsWith('/api/')) return true
  if (url.startsWith(window.location.origin + '/api/')) return true
  return false
}

export async function apiFetch(
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  const url = input
  const headers = new Headers(init.headers || {})
  if (isApiUrl(url)) {
    const token = getAuthToken()
    if (token) headers.set('Authorization', 'Bearer ' + token)
  }
  const res = await fetch(input, { ...init, headers })
  if (res.status === 401 && isApiUrl(url)) {
    clearAuthToken()
    setAuthStatus('unauthenticated')
  }
  return res
}

// Validate the currently-stored token against the backend. Returns true
// if /api/auth/status reports authenticated:true, false otherwise. Does
// NOT mutate the auth-status store -- the caller decides what to do.
export async function validateToken(token?: string): Promise<boolean> {
  const t = token ?? getAuthToken()
  if (!t) return false
  try {
    const res = await fetch('/api/auth/status', {
      headers: { Authorization: 'Bearer ' + t },
    })
    if (!res.ok) return false
    const data = (await res.json()) as { authenticated?: boolean }
    return !!data.authenticated
  } catch {
    return false
  }
}

// Tiny JSON helper used by hooks so each call site does not repeat the
// res.ok / res.json dance. Throws an Error with the response status so
// react-query's error state lights up.
export async function apiJson<T>(
  input: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await apiFetch(input, init)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}${text ? ': ' + text.slice(0, 200) : ''}`)
  }
  return (await res.json()) as T
}

// --- User auth (email/password sessions) ---

const USER_TOKEN_KEY = 'marveen-user-token'
const USER_ROLE_KEY = 'marveen-user-role'
const USER_EMAIL_KEY = 'marveen-user-email'

export function getUserToken(): string | null { return localStorage.getItem(USER_TOKEN_KEY) }
export function getUserRole(): 'admin' | 'user' | null { return localStorage.getItem(USER_ROLE_KEY) as 'admin' | 'user' | null }
export function getUserEmail(): string | null { return localStorage.getItem(USER_EMAIL_KEY) }

export function setUserSession(token: string, role: 'admin' | 'user', email: string): void {
  localStorage.setItem(USER_TOKEN_KEY, token)
  localStorage.setItem(USER_ROLE_KEY, role)
  localStorage.setItem(USER_EMAIL_KEY, email)
}

export function clearUserSession(): void {
  localStorage.removeItem(USER_TOKEN_KEY)
  localStorage.removeItem(USER_ROLE_KEY)
  localStorage.removeItem(USER_EMAIL_KEY)
}

export function userApiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = getUserToken()
  const headers = new Headers(init.headers || {})
  headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', 'Bearer ' + token)
  return fetch(input, { ...init, headers })
}

export async function userApiJson<T>(input: string, init: RequestInit = {}): Promise<T> {
  const res = await userApiFetch(input, init)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}
