'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'
import { getCacheEpoch, readCache, writeCache } from '@/lib/cache/cacheStore'
import type { SnapshotDescriptor } from '@/lib/cache/workspaceSnapshots'
import {
  authoritativeView,
  initialSnapshot,
  snapshotReducer,
  snapshotView,
} from '@/lib/snapshots/snapshotState'

// How long after the last change a snapshot is written to disk. Realtime can
// deliver a burst of events; one write per burst is enough.
export const SNAPSHOT_WRITE_DELAY_MS = 300

// One list of workspace data (tasks, goals, members, ...) held with its origin,
// hydrated from the local cache and persisted back to it. See
// lib/snapshots/snapshotState.ts for the rules; this is the React side of them.
//
//   - It reads the cache once per user+workspace (+scope) and fills the list
//     only if nothing better has arrived (`origin: 'cache'`).
//   - The caller's fetch calls `confirm(rows)` when Supabase answers
//     (`origin: 'server'`); realtime events and optimistic edits go through
//     `setData`, which never upgrades the origin.
//   - Only a `server` snapshot is written back: cached data is not re-saved as if
//     it were fresh, so the cache never certifies itself.
//   - Everything is derived for the CURRENT user/workspace while rendering, so an
//     account or workspace switch never shows the previous one's data.
//
// `workspaceId` and `scope` name what the data belongs to (the cache key holds
// the user, the entity, and both of these). Pass neither and the hook is inert.
export function useWorkspaceSnapshot<T>({
  userId,
  workspaceId,
  scope,
  descriptor,
  initial,
  persist = true,
  shouldPersist,
  workspaceIdOf,
}: {
  userId: string | null | undefined
  workspaceId?: string | null
  // A narrower scope inside the workspace (a task's notes), or, for something
  // that isn't in one workspace, the whole scope.
  scope?: string
  descriptor: SnapshotDescriptor<T>
  // A stable value (module constant): it is what an empty snapshot shows.
  initial: T
  // false: origin tracking only, nothing read from or written to disk.
  persist?: boolean
  // Some states must not be cached (a "no access" answer).
  shouldPersist?: (data: T) => boolean
  // The workspace a persisted value belongs to, when only the data knows it
  // (the workspace detail is looked up by slug before its id is known).
  workspaceIdOf?: (data: T) => string | null
}) {
  const storeScope = [workspaceId, scope].filter(Boolean).join('/')
  const { entity, validate } = descriptor
  const key = userId && storeScope ? `${userId}|${entity}|${storeScope}` : null
  const target = useMemo(
    () => (userId && storeScope ? { userId, entity, storeScope } : null),
    [userId, entity, storeScope],
  )

  const [state, dispatch] = useReducer(
    snapshotReducer<T>,
    key,
    (initialKey: string | null) => initialSnapshot(initialKey, initial),
  )
  const view = snapshotView(state, key, initial)

  // Optional callbacks are read at write time, not captured, so callers can pass
  // inline functions without re-running the effects below.
  const latest = useRef({ shouldPersist, workspaceIdOf, workspaceId })
  latest.current = { shouldPersist, workspaceIdOf, workspaceId }

  // Point the state at the new key when the user/workspace changes. (The view
  // above already hides the old one, so this is bookkeeping, not what prevents
  // a flash.)
  const currentKey = useRef(key)
  useEffect(() => {
    if (currentKey.current === key) return
    currentKey.current = key
    dispatch({ type: 'reset', key, initial })
  }, [key, initial])

  // Read the cache, once per key. `hydrated` says the read has finished (found
  // something or not): a failed network request can come back before the disk
  // does, so anything that depends on "was there a cache?" must wait for it.
  const [hydratedKey, setHydratedKey] = useState<string | null>(null)
  useEffect(() => {
    if (!persist || !target || !key) return
    let cancelled = false
    void readCache<unknown>(target.userId, target.entity, target.storeScope)
      .then(hit => {
        if (cancelled || !hit || !validate(hit.data)) return
        dispatch({ type: 'hydrate', key, data: hit.data })
      })
      .catch(() => undefined)
      .then(() => {
        if (!cancelled) setHydratedKey(key)
      })
    return () => {
      cancelled = true
    }
  }, [persist, target, key, validate])
  const hydrated = !persist || !key || hydratedKey === key

  // Write back what the server has confirmed (and what has happened to it
  // since), a moment after the last change.
  const pendingWrite = useRef<(() => void) | null>(null)
  useEffect(() => {
    if (!persist || !target || view.origin !== 'server') return
    const data = view.data
    if (latest.current.shouldPersist?.(data) === false) return
    const epoch = getCacheEpoch()
    const write = () => {
      pendingWrite.current = null
      // Wiped (logout, account switch, access lost) since this was scheduled:
      // do not put it back.
      if (getCacheEpoch() !== epoch) return
      void writeCache(
        target.userId,
        target.entity,
        target.storeScope,
        data,
        latest.current.workspaceIdOf?.(data) ??
          latest.current.workspaceId ??
          null,
      )
    }
    pendingWrite.current = write
    const timer = setTimeout(write, SNAPSHOT_WRITE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [persist, target, view.origin, view.data])

  // Leaving (or switching to another workspace) with a write still waiting
  // flushes it, so the last change isn't lost to the delay.
  useEffect(
    () => () => {
      pendingWrite.current?.()
    },
    [target],
  )

  const setData = useCallback(
    (next: T | ((current: T) => T)) => {
      if (key) dispatch({ type: 'change', key, next })
    },
    [key],
  )
  const confirm = useCallback(
    (data: T) => {
      if (key) dispatch({ type: 'confirm', key, data })
    },
    [key],
  )

  const authoritative = useMemo(
    () => authoritativeView(view),
    // Derived from the snapshot's own parts, so it is a new value only when the
    // origin or data actually changes (not on every render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [view.origin, view.data],
  )

  return {
    data: view.data,
    origin: view.origin,
    hydrated,
    setData,
    confirm,
    authoritative,
  }
}
