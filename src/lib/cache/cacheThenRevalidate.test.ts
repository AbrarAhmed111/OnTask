import { describe, expect, it, vi } from 'vitest'
import { cacheThenRevalidate } from '@/lib/cache/cacheThenRevalidate'
import { clearAllCache } from '@/lib/cache/cacheStore'

type Data = { v: number }

// A promise settled from outside, to control which of cache / network answers
// first.
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function setup(
  overrides: Partial<Parameters<typeof cacheThenRevalidate<Data>>[0]> = {},
) {
  const events: string[] = []
  const write = vi.fn(async (data: Data) => {
    events.push(`write:${data.v}`)
  })
  const options = {
    read: async () => undefined,
    fetchFresh: async () => ({ v: 2 }),
    write,
    isCancelled: () => false,
    onCached: (hit: { data: Data }) => events.push(`cached:${hit.data.v}`),
    onFresh: (data: Data) => events.push(`fresh:${data.v}`),
    onError: (_error: unknown, info: { hadCache: boolean }) =>
      events.push(`error:hadCache=${info.hadCache}`),
    ...overrides,
  }
  return { events, write, run: () => cacheThenRevalidate<Data>(options) }
}

describe('cacheThenRevalidate', () => {
  it('cold start: nothing cached, so it shows the network result and caches it', async () => {
    const { events, run } = setup()

    await run()

    expect(events).toEqual(['fresh:2', 'write:2'])
  })

  it('warm start: shows the cached data first, then the network result', async () => {
    const { events, run } = setup({
      read: async () => ({ data: { v: 1 }, cachedAt: 100 }),
    })

    await run()

    expect(events).toEqual(['cached:1', 'fresh:2', 'write:2'])
  })

  it('stale cache: the cached copy is replaced by the fresh one and re-cached', async () => {
    const { events, write, run } = setup({
      read: async () => ({ data: { v: 1 }, cachedAt: 1 }),
      fetchFresh: async () => ({ v: 5 }),
    })

    await run()

    expect(events.at(-2)).toBe('fresh:5')
    expect(write).toHaveBeenCalledWith({ v: 5 })
  })

  it('never lets a late cache read overwrite data the network already delivered', async () => {
    const read = deferred<{ data: Data; cachedAt: number } | undefined>()
    const { events, run } = setup({ read: () => read.promise })

    await run()
    // The disk answers only after the network has.
    read.resolve({ data: { v: 1 }, cachedAt: 1 })
    await read.promise

    expect(events).toEqual(['fresh:2', 'write:2'])
  })

  it('does not hold the network request back while the cache is read', async () => {
    const read = deferred<undefined>()
    const fetchFresh = vi.fn(async () => ({ v: 2 }))
    const { run } = setup({ read: () => read.promise, fetchFresh })

    const finished = run()

    // The fetch has started even though the cache read is still pending.
    expect(fetchFresh).toHaveBeenCalledTimes(1)
    read.resolve(undefined)
    await finished
  })

  it('offline with a cache: reports the failure but tells the caller it has cached data', async () => {
    const { events, write, run } = setup({
      read: async () => ({ data: { v: 1 }, cachedAt: 1 }),
      fetchFresh: async () => {
        throw new Error('offline')
      },
    })

    await run()

    expect(events).toEqual(['cached:1', 'error:hadCache=true'])
    // A failed fetch must never overwrite the last good snapshot.
    expect(write).not.toHaveBeenCalled()
  })

  it('offline with no cache: reports the failure as a plain error', async () => {
    const { events, run } = setup({
      fetchFresh: async () => {
        throw new Error('offline')
      },
    })

    await run()

    expect(events).toEqual(['error:hadCache=false'])
  })

  it('waits for a slow cache read before deciding whether the failure had a cache', async () => {
    const read = deferred<{ data: Data; cachedAt: number } | undefined>()
    const { events, run } = setup({
      read: () => read.promise,
      fetchFresh: async () => {
        throw new Error('offline')
      },
    })

    const finished = run()
    read.resolve({ data: { v: 1 }, cachedAt: 1 })
    await finished

    expect(events).toEqual(['cached:1', 'error:hadCache=true'])
  })

  it('publishes provisional results early but caches only the final one', async () => {
    const { events, write, run } = setup({
      fetchFresh: async emit => {
        emit({ v: 10 })
        return { v: 11 }
      },
    })

    await run()

    expect(events).toEqual(['fresh:10', 'fresh:11', 'write:11'])
    expect(write).toHaveBeenCalledTimes(1)
  })

  it('a cancelled consumer gets no callbacks, but the true result is still cached', async () => {
    const { events, run } = setup({
      read: async () => ({ data: { v: 1 }, cachedAt: 1 }),
      isCancelled: () => true,
    })

    await run()

    expect(events).toEqual(['write:2'])
  })

  it('a cancelled consumer is not told about failures either', async () => {
    const { events, run } = setup({
      isCancelled: () => true,
      fetchFresh: async () => {
        throw new Error('offline')
      },
    })

    await run()

    expect(events).toEqual([])
  })

  it('does not write a response that finished after the cache was wiped', async () => {
    // Logout while a revalidation is in flight: the old user's data must not
    // be put back once the response lands.
    const { events, write, run } = setup({
      fetchFresh: async () => {
        await clearAllCache()
        return { v: 2 }
      },
    })

    await run()

    expect(events).toEqual(['fresh:2'])
    expect(write).not.toHaveBeenCalled()
  })
})
