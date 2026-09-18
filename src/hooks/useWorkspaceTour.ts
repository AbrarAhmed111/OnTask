'use client'

import { useEffect, useRef, useState } from 'react'
import { useTour } from '@/components/tour/TourProvider'
import { useWorkspaceDetail } from '@/components/workspaces/WorkspaceDetailContext'
import { TOURS, tourIdForWorkspace } from '@/lib/tour/definitions'
import { shouldAutoStartInitialTour } from '@/lib/tour/eligibility'
import { fetchTourOutcome } from '@/lib/tour/progress'

// A beat between "the page has its content" and "a tour opens over it", so the
// tour arrives on a settled page instead of on top of content still fading in.
const SETTLE_MS = 600

// Runs the workspace's tour from the Overview, where every target lives.
// Automatic onboarding is user-level: only an unseen Personal Workspace tour
// can open on its own. A shared workspace never becomes eligible merely by
// being new to the user. Replay from Settings remains available for either
// workspace type and intentionally ignores the recorded outcome.
//
// `contentReady` is the page's own "everything has loaded" signal: a tour must
// wait for it, because steps are only kept if their target is on screen, and
// sections render placeholders until their data arrives.
//
// Leaving the Overview ends a running tour without recording an outcome, so
// it is offered again rather than counted as seen.
export function useWorkspaceTour({ contentReady }: { contentReady: boolean }) {
  const { user, workspaceId, isPersonal } = useWorkspaceDetail()
  const { canStart, start, cancel, replayRequest, clearReplayRequest } =
    useTour()
  const tourId = tourIdForWorkspace(isPersonal ? 'personal' : 'shared')
  const userId = user.id

  // This is the user-level initial onboarding flag, persisted through the
  // user's Personal Workspace progress row. Existing members are backfilled as
  // skipped by migration 0039; a new account has no row until this tour ends.
  const [initialTourDue, setInitialTourDue] = useState<boolean | null>(null)
  // The initial tour already opened during this mounted visit. This prevents
  // stale state from reopening it after completion or skipping.
  const opened = useRef(new Set<string>())

  useEffect(() => {
    if (!workspaceId || !isPersonal) {
      setInitialTourDue(false)
      return
    }
    let cancelled = false
    setInitialTourDue(null)
    fetchTourOutcome(userId, workspaceId, 'personal-workspace')
      .then(outcome => {
        if (!cancelled) setInitialTourDue(outcome === null)
      })
      .catch(error => console.error('Could not load tour progress:', error))
    return () => {
      cancelled = true
    }
  }, [userId, workspaceId, isPersonal])

  const key = `${userId}:initial-onboarding`
  const replaying = replayRequest === tourId
  const openOnItsOwn = shouldAutoStartInitialTour({
    isPersonal,
    initialTourDue,
    alreadyOpened: opened.current.has(key),
  })

  useEffect(() => {
    if (!workspaceId || !contentReady || !canStart) return
    if (!replaying && !openOnItsOwn) return
    const timer = window.setTimeout(() => {
      if (replaying) clearReplayRequest()
      opened.current.add(key)
      start(TOURS[tourId])
    }, SETTLE_MS)
    return () => window.clearTimeout(timer)
  }, [
    workspaceId,
    contentReady,
    canStart,
    replaying,
    openOnItsOwn,
    clearReplayRequest,
    start,
    key,
    tourId,
  ])

  // Also ends a tour when the workspace under it changes (browser back/forward
  // between two workspaces keeps this page mounted), so it never keeps
  // describing one workspace over another's content.
  useEffect(() => cancel, [cancel, workspaceId])
}
