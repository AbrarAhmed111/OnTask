import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

export type AuthUser = {
  id: string
  email: string | null
  fullName: string | null
  avatarUrl: string | null
}

function toAuthUser(user: User | null): AuthUser | null {
  if (!user) return null
  const metadata = user.user_metadata ?? {}
  return {
    id: user.id,
    email: user.email ?? null,
    fullName:
      (metadata.full_name as string | undefined) ||
      (metadata.name as string | undefined) ||
      null,
    avatarUrl: (metadata.avatar_url as string | undefined) || null,
  }
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [ready, setReady] = useState(false)
  const [passwordRecovery, setPasswordRecovery] = useState(false)

  useEffect(() => {
    let active = true
    const supabase = createClient()

    supabase.auth.getUser().then(({ data }) => {
      if (!active) return
      setUser(toAuthUser(data.user))
      setReady(true)

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
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
      setUser(toAuthUser(session?.user ?? null))
      setReady(true)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  return {
    user,
    ready,
    passwordRecovery,
    clearPasswordRecovery: () => setPasswordRecovery(false),
  }
}
