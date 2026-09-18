'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { clientSignout } from '@/lib/auth/signout'

// Redirects signed-out visitors to "/" (where the header's auth button opens
// the sign-in modal) and centralizes the logout transition, so every shell
// that requires a signed-in user (the plain workspaces list, the individual
// workspace shell) shares one auth-gating path instead of re-deriving it.
export function useAuthGuard() {
  const { user, ready: authReady } = useAuth()
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    if (!authReady || user) return
    // Preserve query params (e.g. an invitation's ?invite=&workspace=) so
    // the home page can still pick them up and show a contextual login
    // prompt instead of silently dropping them on the bounce to "/". Every
    // shell guarded by this hook today is workspace-gated, so `authIntent`
    // rides along too -- Dashboard.tsx uses it to auto-open the sign-in
    // modal with workspace-specific copy instead of just the bare landing
    // page (an invitation's own params, if present, take precedence there).
    const params =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search)
        : new URLSearchParams()
    params.set('authIntent', 'workspaces')
    router.replace(`/?${params.toString()}`)
  }, [authReady, user, router])

  const handleLogout = async () => {
    setLoggingOut(true)
    await clientSignout()
    router.push('/')
  }

  return { user, ready: authReady && !loggingOut, handleLogout }
}
