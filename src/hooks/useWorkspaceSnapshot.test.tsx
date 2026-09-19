import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, settle } from '@/test/renderHook'
import {
  SNAPSHOT_WRITE_DELAY_MS,
  useWorkspaceSnapshot,
} from '@/hooks/useWorkspaceSnapshot'
import { clearAllCache, readCache, writeCache } from '@/lib/cache/cacheStore'
import { putRecord } from '@/lib/cache/idb'
import type { SnapshotDescriptor } from '@/lib/cache/workspaceSnapshots'

const things: SnapshotDescriptor<string[]> = {
  entity: 'things',
  validate: (value): value is string[] =>
    Array.isArray(value) && value.every(item => typeof item === 'string'),
}
const EMPTY: string[] = []

type Props = {
  userId: string | null
  workspaceId?: string | null
  persist?: boolean
  shouldPersist?: (data: string[]) => boolean
}

const useThings = ({ userId, workspaceId = 'ws-1', ...rest }: Props) =>
  useWorkspaceSnapshot<string[]>({
    userId,
    workspaceId,
    descriptor: things,
    initial: EMPTY,
    ...rest,
  })

// Real IndexedDB, fake timers for the write delay only.
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  await clearAllCache()
})
afterEach(() => {
  vi.useRealTimers()
})

async function flushWrites() {
  await act(async () => {
    vi.advanceTimersByTime(SNAPSHOT_WRITE_DELAY_MS + 1)
  })
  await settle()
}

describe('useWorkspaceSnapshot', () => {
  it('cold start: nothing cached, the server answer is shown, confirmed and then cached', async () => {
    const hook = renderHook(useThings, { userId: 'user-a' })
    await settle()
    expect(hook.result.current.origin).toBe('empty')

    act(() => hook.result.current.confirm(['from server']))

    expect(hook.result.current.data).toEqual(['from server'])
    expect(hook.result.current.origin).toBe('server')
    expect(hook.result.current.authoritative?.data).toEqual(['from server'])
    await flushWrites()
    expect((await readCache('user-a', 'things', 'ws-1'))?.data).toEqual([
      'from server',
    ])
  })

  it('warm start: shows the cached data straight away, but not as confirmed', async () => {
    await writeCache('user-a', 'things', 'ws-1', ['cached'], 'ws-1')

    const hook = renderHook(useThings, { userId: 'user-a' })
    await settle()

    expect(hook.result.current.data).toEqual(['cached'])
    expect(hook.result.current.origin).toBe('cache')
    // Rendering may use it; anything that decides or acts on it may not.
    expect(hook.result.current.authoritative).toBeNull()
  })

  it('warm start: the server answer replaces the cached data and confirms it', async () => {
    await writeCache('user-a', 'things', 'ws-1', ['stale'], 'ws-1')
    const hook = renderHook(useThings, { userId: 'user-a' })
    await settle()

    act(() => hook.result.current.confirm(['fresh']))

    expect(hook.result.current.data).toEqual(['fresh'])
    expect(hook.result.current.authoritative?.data).toEqual(['fresh'])
  })

  it('a cache read that finishes after the server answer does not overwrite it', async () => {
    await writeCache('user-a', 'things', 'ws-1', ['older cache'], 'ws-1')
    const hook = renderHook(useThings, { userId: 'user-a' })
    // The server answers before the disk does.
    act(() => hook.result.current.confirm(['fresh']))
    await settle()

    expect(hook.result.current.data).toEqual(['fresh'])
    expect(hook.result.current.origin).toBe('server')
  })

  it('never re-saves cached data as if it were fresh', async () => {
    await putRecord({
      key: 'user-a:things:ws-1',
      userId: 'user-a',
      workspaceId: 'ws-1',
      entity: 'things',
      scopeId: 'ws-1',
      schemaVersion: 1,
      cachedAt: 12345,
      data: ['cached'],
    })
    const hook = renderHook(useThings, { userId: 'user-a' })
    await settle()

    await flushWrites()

    // Untouched: still the original timestamp, so the cache didn't certify itself.
    expect((await readCache('user-a', 'things', 'ws-1'))?.cachedAt).toBe(12345)
    hook.unmount()
  })

  it('realtime changes on top of confirmed data are persisted', async () => {
    const hook = renderHook(useThings, { userId: 'user-a' })
    await settle()
    act(() => hook.result.current.confirm(['a']))

    act(() => hook.result.current.setData(current => [...current, 'b']))
    await flushWrites()

    expect((await readCache('user-a', 'things', 'ws-1'))?.data).toEqual([
      'a',
      'b',
    ])
  })

  it('changes on top of cached data are not persisted until the server has answered', async () => {
    await writeCache('user-a', 'things', 'ws-1', ['cached'], 'ws-1')
    const hook = renderHook(useThings, { userId: 'user-a' })
    await settle()

    act(() => hook.result.current.setData(current => [...current, 'event']))
    await flushWrites()

    expect(hook.result.current.origin).toBe('cache')
    expect((await readCache('user-a', 'things', 'ws-1'))?.data).toEqual([
      'cached',
    ])
  })

  it('a burst of changes is written once, with the final value', async () => {
    const hook = renderHook(useThings, { userId: 'user-a' })
    await settle()
    act(() => hook.result.current.confirm(['1']))
    act(() => hook.result.current.setData(['1', '2']))
    act(() => hook.result.current.setData(['1', '2', '3']))

    await flushWrites()

    expect((await readCache('user-a', 'things', 'ws-1'))?.data).toEqual([
      '1',
      '2',
      '3',
    ])
  })

  it('leaving before the write delay still saves the last change', async () => {
    const hook = renderHook(useThings, { userId: 'user-a' })
    await settle()
    act(() => hook.result.current.confirm(['last']))

    hook.unmount()
    await settle()

    expect((await readCache('user-a', 'things', 'ws-1'))?.data).toEqual([
      'last',
    ])
  })

  it('does not write anything that finished after the cache was wiped (logout)', async () => {
    const hook = renderHook(useThings, { userId: 'user-a' })
    await settle()
    act(() => hook.result.current.confirm(['secret']))

    await clearAllCache() // logout, before the delayed write fires
    await flushWrites()

    expect(await readCache('user-a', 'things', 'ws-1')).toBeUndefined()
  })

  it("never renders one account's data for another, on any render", async () => {
    await writeCache('user-a', 'things', 'ws-1', ['A-SECRET'], 'ws-1')
    const hook = renderHook(useThings, { userId: 'user-a' })
    await settle()
    act(() => hook.result.current.confirm(['A-SECRET']))
    expect(hook.result.current.data).toEqual(['A-SECRET'])

    // Account switch in place: the very next render, and everything after,
    // belongs to B.
    hook.renders.length = 0
    hook.rerender({ userId: 'user-b' })
    await settle()
    await flushWrites()

    for (const render of hook.renders) {
      expect(render.data).toEqual([])
      expect(render.authoritative).toBeNull()
    }
    expect(hook.result.current.origin).toBe('empty')
    // B has no cache of their own, and A's was not moved over to them.
    expect(await readCache('user-b', 'things', 'ws-1')).toBeUndefined()
  })

  it("never renders another workspace's data for this one", async () => {
    await writeCache('user-a', 'things', 'ws-1', ['WS1-DATA'], 'ws-1')
    const hook = renderHook(useThings, {
      userId: 'user-a',
      workspaceId: 'ws-1',
    })
    await settle()
    expect(hook.result.current.data).toEqual(['WS1-DATA'])

    hook.renders.length = 0
    hook.rerender({ userId: 'user-a', workspaceId: 'ws-2' })
    await settle()

    for (const render of hook.renders) expect(render.data).toEqual([])
  })

  it('ignores cached data that no longer has the expected shape', async () => {
    await writeCache('user-a', 'things', 'ws-1', [{ not: 'a string' }], 'ws-1')

    const hook = renderHook(useThings, { userId: 'user-a' })
    await settle()

    expect(hook.result.current.origin).toBe('empty')
    expect(hook.result.current.data).toEqual([])
  })

  it('does not cache a state it was told not to (e.g. "no access")', async () => {
    const hook = renderHook(useThings, {
      userId: 'user-a',
      shouldPersist: data => data.length > 0,
    })
    await settle()

    act(() => hook.result.current.confirm([]))
    await flushWrites()

    expect(await readCache('user-a', 'things', 'ws-1')).toBeUndefined()
  })

  it('with persist off it tracks the origin but touches no disk', async () => {
    await writeCache('user-a', 'things', 'ws-1', ['cached'], 'ws-1')
    const hook = renderHook(useThings, { userId: 'user-a', persist: false })
    await settle()
    expect(hook.result.current.data).toEqual([]) // the cache is not read

    act(() => hook.result.current.confirm(['fresh']))
    await flushWrites()

    expect(hook.result.current.origin).toBe('server')
    expect((await readCache('user-a', 'things', 'ws-1'))?.data).toEqual([
      'cached',
    ])
  })

  it('is inert without a signed-in user', async () => {
    const hook = renderHook(useThings, { userId: null })
    await settle()

    act(() => hook.result.current.confirm(['x']))

    expect(hook.result.current.data).toEqual([])
    expect(hook.result.current.origin).toBe('empty')
  })
})
