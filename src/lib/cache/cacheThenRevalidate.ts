import { CacheHit, getCacheEpoch } from '@/lib/cache/cacheStore'

// The stale-while-revalidate flow every cached hook shares (local-cache.md §9):
//
//   cache hit  -> onCached now, then onFresh once the network answers
//   cache miss -> onFresh once the network answers (same as before caching)
//   network fails -> onError, with `hadCache` so the caller can keep showing
//                    the cached data instead of replacing it with an error
//
// It is plain async code with no React in it, so the ordering rules below are
// unit-tested directly; the hooks only supply the five callbacks.
export type CacheThenRevalidate<T> = {
  read: () => Promise<CacheHit<T> | undefined>
  // Should throw when the fetch fails. `emit` publishes a provisional result
  // early (e.g. the first of two queries) without waiting for the last one;
  // the returned value is the complete, final result and is what gets cached.
  fetchFresh: (emit: (provisional: T) => void) => Promise<T>
  write: (data: T) => Promise<void>
  // True once the consumer no longer wants updates (unmounted, or the user or
  // workspace changed). Stops callbacks; see the note on `write` below.
  isCancelled: () => boolean
  onCached: (hit: CacheHit<T>) => void
  onFresh: (data: T) => void
  onError: (error: unknown, info: { hadCache: boolean }) => void
}

export async function cacheThenRevalidate<T>(
  options: CacheThenRevalidate<T>,
): Promise<void> {
  const { read, fetchFresh, write, isCancelled } = options
  const epoch = getCacheEpoch()
  let freshArrived = false
  let hadCache = false

  // Started together with the fetch, not before it, so a slow disk never
  // delays the network request.
  const cached = read().then(
    hit => {
      // The cache is only ever a head start: if the network already answered,
      // the cached copy is older and must not replace it.
      if (!hit || freshArrived || isCancelled()) return
      hadCache = true
      options.onCached(hit)
    },
    () => undefined,
  )

  let fresh: T
  try {
    fresh = await fetchFresh(provisional => {
      if (isCancelled()) return
      freshArrived = true
      options.onFresh(provisional)
    })
  } catch (error) {
    // Wait for the cache read so `hadCache` is settled before the caller
    // decides between "keep showing it" and "show an error".
    await cached
    if (!isCancelled()) options.onError(error, { hadCache })
    return
  }

  freshArrived = true
  if (!isCancelled()) options.onFresh(fresh)

  // Deliberately not skipped when merely cancelled: a page left mid-request
  // still learned something true, and it is written under the user captured
  // by `write`. What must never be written is anything that finished after the
  // cache was wiped (logout / account switch), which the epoch check covers.
  if (getCacheEpoch() !== epoch) return
  await write(fresh)
}
