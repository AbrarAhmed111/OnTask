'use client'

import { useEffect, useRef, useState } from 'react'
import type { AuthUser } from '@/hooks/useAuth'
import { hasVisitorWelcomeSeen, markVisitorWelcomeSeen } from '@/lib/storage'

// The entry welcome is deliberately separate from authenticated workspace
// onboarding. Invitation and workspace-intent links already have a specific
// auth flow, so they must not be interrupted by a generic guest welcome.
export function useVisitorWelcome({
  authReady,
  user,
}: {
  authReady: boolean
  user: AuthUser | null
}) {
  const [open, setOpen] = useState(false)
  const [checked, setChecked] = useState(false)
  const skippedForSession = useRef(false)

  useEffect(() => {
    if (!authReady) return

    const params = new URLSearchParams(window.location.search)
    if (params.has('invite') || params.get('authIntent') === 'workspaces') {
      skippedForSession.current = true
    }

    if (user || skippedForSession.current) {
      if (user) markVisitorWelcomeSeen()
      setChecked(true)
      return
    }

    if (hasVisitorWelcomeSeen()) {
      setChecked(true)
      return
    }

    // Mark it when it is first shown, so a refresh or closed tab cannot make
    // the same entry dialog reappear indefinitely.
    markVisitorWelcomeSeen()
    setOpen(true)
    setChecked(true)
  }, [authReady, user])

  return {
    open,
    checked,
    close: () => setOpen(false),
  }
}
