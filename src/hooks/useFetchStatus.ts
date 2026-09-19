'use client'

import { useCallback, useState } from 'react'
import type { SnapshotOrigin } from '@/lib/snapshots/snapshotState'

// "Is there something to show, and did the refresh work?" for a cached list --
// the same logic every cached hook needs, in one place.
//
//   ready  there is something to render: the cache had it, or the server has
//          answered. It is never true on a failed fetch until the cache read has
//          finished, so a network error that returns before the disk does can't
//          flash an empty list over data that is about to appear.
//   error  the refresh failed. Worded by what is on screen: "couldn't load" when
//          there is nothing, "couldn't refresh -- may be out of date" when the
//          cached copy is what is being shown. The cached data itself is never
//          removed because a fetch failed.
//
// `succeeded`/`failed` are for the fetch callbacks; they are bound to the
// current key, so a late callback from the previous user/workspace is ignored.
export function useFetchStatus(
  snapshot: { origin: SnapshotOrigin; hydrated: boolean },
  // Names what is being loaded (user + workspace); null when nothing is.
  fetchKey: string | null,
  messages: { load: string; refresh: string },
) {
  const [outcome, setOutcome] = useState<{
    key: string
    failed: boolean
  } | null>(null)

  const succeeded = useCallback(() => {
    if (fetchKey) setOutcome({ key: fetchKey, failed: false })
  }, [fetchKey])
  const failed = useCallback(() => {
    if (fetchKey) setOutcome({ key: fetchKey, failed: true })
  }, [fetchKey])

  const answered = outcome?.key === fetchKey
  const ready =
    !fetchKey || snapshot.origin !== 'empty' || (answered && snapshot.hydrated)
  const error =
    answered && outcome?.failed && snapshot.hydrated
      ? snapshot.origin === 'empty'
        ? messages.load
        : messages.refresh
      : null

  return { ready, error, succeeded, failed }
}
