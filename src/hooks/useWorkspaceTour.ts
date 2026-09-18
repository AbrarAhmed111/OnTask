'use client'

import { useEffect, useRef, useState } from 'react'
import { useTour } from '@/components/tour/TourProvider'
import { useWorkspaceDetail } from '@/components/workspaces/WorkspaceDetailContext'
import { TOURS, tourIdForWorkspace } from '@/lib/tour/definitions'
import { fetchTourOutcome } from '@/lib/tour/progress'

// A beat between "the page has its content" and "a tour opens over it", so the
// tour arrives on a settled page instead of on top of content still fading in.
const SETTLE_MS = 600

// Runs the workspace's tour from the Overview, where every target lives.
// Two things start it:
//
//  - First visit: this user has never completed or skipped this workspace's
//    tour (per workspace -- see lib/tour/progress). It opens by itself, once,
//    when the page is ready and nothing else is asking for attention.
//  - Replay: Settings filed a request (see TourProvider). It opens the same
//    way but ignores what was recorded.
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

  // true: never seen, so due. false: already completed or skipped. null: not
  // known yet, or the lookup failed -- and an unknown is never treated as due,
  // so a broken lookup can't put the tour in front of someone on every load.
  const [due, setDue] = useState<boolean | null>(null)
  // Tours this page has already opened on its own, so finishing one (which
  // leaves `due` stale until the next visit) can't reopen it.
  const opened = useRef(new Set<string>())

  useEffect(() => {
    if (!workspaceId) return
    let cancelled = false
    setDue(null)
    fetchTourOutcome(userId, workspaceId, tourId)
      .then(outcome => {
        if (!cancelled) setDue(outcome === null)
      })
      .catch(error => console.error('Could not load tour progress:', error))
    return () => {
      cancelled = true
    }
  }, [userId, workspaceId, tourId])

  const key = `${workspaceId}:${tourId}`
  const replaying = replayRequest === tourId
  const openOnItsOwn = due === true && !opened.current.has(key)

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
