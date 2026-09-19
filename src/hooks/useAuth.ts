import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AuthUser } from '@/lib/auth/authUser'
import { watchAuthUser } from '@/lib/auth/watchAuthUser'

// Kept exported from here: it is what the rest of the app imports.
export type { AuthUser }

// The signed-in user, from the local session first and confirmed by the server
// after (see lib/auth/watchAuthUser.ts for why the two are treated differently).
export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [ready, setReady] = useState(false)
  const [passwordRecovery, setPasswordRecovery] = useState(false)

  useEffect(() => {
    return watchAuthUser(createClient().auth, {
      onUser: nextUser => {
        setUser(nextUser)
        setReady(true)
      },
      onPasswordRecovery: () => setPasswordRecovery(true),
      onServerChecked: () => {
        // Clean up OAuth/recovery params left in the URL after Supabase's
        // browser client auto-exchanges them for a session on load. Only the
        // auth handshake's own params are removed — anything else the page was
        // opened with (e.g. an invitation link's ?invite=&workspace=) must
        // survive so the page can still act on it.
        const url = new URL(window.location.href)
        if (
          url.searchParams.has('code') ||
          window.location.hash.includes('access_token')
        ) {
          url.searchParams.delete('code')
          window.history.replaceState(null, '', `${url.pathname}${url.search}`)
        }
      },
    })
  }, [])

  return {
    user,
    ready,
    passwordRecovery,
    clearPasswordRecovery: () => setPasswordRecovery(false),
  }
}
