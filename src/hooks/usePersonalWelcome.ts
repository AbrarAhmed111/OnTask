'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AuthUser } from '@/hooks/useAuth'
import type { Workspace } from '@/types/workspace'

function browserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null
  } catch {
    return null
  }
}

// Drives the one-time "Welcome to your Personal Workspace" dialog.
//
// "Already shown" lives on the user's profile row (personal_welcome_seen_at),
// not in the browser, so it holds across devices and after clearing site
// data. It's recorded the moment the dialog is first SHOWN rather than when
// it's dismissed, so closing the tab with the dialog open still counts as
// seeing it — it can never appear twice.
//
// The same first visit is also when the workspace adopts the browser's
// timezone (it's created as UTC, before the app knows where the user is),
// so the daily report time and clock are right from the start.
export function usePersonalWelcome({
  user,
  workspace,
  updateWorkspace,
}: {
  user: AuthUser
  workspace: Workspace | null
  updateWorkspace: (patch: { timezone: string }) => Promise<unknown>
}) {
  const [open, setOpen] = useState(false)
  // True once we know whether the welcome is due, so callers can hold other
  // first-visit dialogs back until then instead of racing it.
  const [checked, setChecked] = useState(false)
  const updateWorkspaceRef = useRef(updateWorkspace)
  useEffect(() => {
    updateWorkspaceRef.current = updateWorkspace
  })

  const workspaceId = workspace?.id
  const isPersonal = workspace?.type === 'personal'
  const timezone = workspace?.timezone
  const userId = user.id

  useEffect(() => {
    if (!workspaceId || !isPersonal) return
    let cancelled = false
    const supabase = createClient()
    supabase
      .from('profiles')
      .select('personal_welcome_seen_at')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        setChecked(true)
        if (!data || data.personal_welcome_seen_at) return
        setOpen(true)
        // Query builders only run once awaited/then'd — a bare `void
        // supabase.rpc(...)` would silently never send the request.
        void supabase.rpc('mark_personal_welcome_seen').then(({ error }) => {
          if (error) console.error('Could not record the welcome:', error)
        })
        const detected = browserTimezone()
        if (timezone === 'UTC' && detected && detected !== 'UTC') {
          void updateWorkspaceRef.current({ timezone: detected })
        }
      })
    return () => {
      cancelled = true
    }
    // `timezone` is only read once, at the moment the welcome first shows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, isPersonal, userId])

  return { open, checked, close: () => setOpen(false) }
}
