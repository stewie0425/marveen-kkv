import { useEffect, useState } from 'react'
import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { router } from './router'
import { ToastContainer } from '@/components/common/ToastContainer'
import { LoginScreen } from '@/components/auth/LoginScreen'
import {
  getAuthToken, validateToken,
  getUserToken, clearUserSession, userApiJson,
} from '@/lib/api'
import { setAuthStatus, useAuthStatus } from '@/lib/auth'
import SetupPage from '@/routes/Setup'
import UserLoginPage from '@/routes/UserLogin'
import ChatPage from '@/routes/Chat'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30_000,
    },
  },
})

type AppView =
  | { kind: 'pending' }
  | { kind: 'setup' }
  | { kind: 'user-login' }
  | { kind: 'admin-token-login' }
  | { kind: 'chat' }
  | { kind: 'dashboard' }

function AuthGate() {
  const adminAuthStatus = useAuthStatus()
  const [view, setView] = useState<AppView>({ kind: 'pending' })

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      // 1. Check if setup is required (no admin exists yet)
      try {
        const { setup_required } = await (
          await fetch('/api/user-auth/setup-required')
        ).json() as { setup_required: boolean }
        if (setup_required) {
          if (!cancelled) setView({ kind: 'setup' })
          return
        }
      } catch { /* backend not ready, fall through */ }

      // 2. Check for a valid user session token
      const userToken = getUserToken()
      if (userToken) {
        try {
          const me = await userApiJson<{ role: 'admin' | 'user' }>('/api/user-auth/me')
          if (!cancelled) {
            setView(me.role === 'admin' ? { kind: 'dashboard' } : { kind: 'chat' })
            if (me.role === 'admin') setAuthStatus('authenticated')
            return
          }
        } catch {
          clearUserSession()
        }
      }

      // 3. Check for admin bearer token
      const adminToken = getAuthToken()
      if (adminToken) {
        const ok = await validateToken(adminToken)
        if (ok) {
          if (!cancelled) { setView({ kind: 'dashboard' }); setAuthStatus('authenticated') }
          return
        }
      }

      // 4. Show user-facing login (email/password)
      if (!cancelled) setView({ kind: 'user-login' })
    }

    bootstrap()
    return () => { cancelled = true }
  }, [])

  if (view.kind === 'pending') {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-[var(--color-text-muted)]">
        Betöltés…
      </div>
    )
  }

  if (view.kind === 'setup') {
    return (
      <SetupPage
        onComplete={() => setView({ kind: 'dashboard' })}
      />
    )
  }

  if (view.kind === 'user-login') {
    return (
      <UserLoginPage
        onSuccess={(role) => setView(role === 'admin' ? { kind: 'dashboard' } : { kind: 'chat' })}
        onAdminToken={() => setView({ kind: 'admin-token-login' })}
      />
    )
  }

  if (view.kind === 'admin-token-login') {
    return (
      <LoginScreen onSuccess={() => { setAuthStatus('authenticated'); setView({ kind: 'dashboard' }) }} />
    )
  }

  if (view.kind === 'chat') {
    return (
      <ChatPage onLogout={() => { clearUserSession(); setView({ kind: 'user-login' }) }} />
    )
  }

  // Dashboard (admin)
  if (adminAuthStatus === 'pending') {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-[var(--color-text-muted)]">
        Betöltés…
      </div>
    )
  }
  return <RouterProvider router={router} />
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthGate />
      <ToastContainer />
    </QueryClientProvider>
  )
}
