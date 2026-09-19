import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// cacheStore and idb keep module-level state (the open connection, who owns
// the cache, the wipe epoch), so every test starts from freshly imported
// modules over a brand-new database.
async function freshModules() {
  vi.resetModules()
  globalThis.indexedDB = new IDBFactory()
  const store = await import('@/lib/cache/cacheStore')
  const idb = await import('@/lib/cache/idb')
  return { store, idb }
}

type Modules = Awaited<ReturnType<typeof freshModules>>
let store: Modules['store']
let idb: Modules['idb']

beforeEach(async () => {
  ;({ store, idb } = await freshModules())
})

describe('readCache / writeCache', () => {
  it('returns what was stored, with when it was stored', async () => {
    const before = Date.now()
    await store.writeCache('user-a', 'things', 'all', { n: 1 })

    const hit = await store.readCache<{ n: number }>('user-a', 'things')

    expect(hit?.data).toEqual({ n: 1 })
    expect(hit!.cachedAt).toBeGreaterThanOrEqual(before)
  })

  it('has nothing for an entry that was never written', async () => {
    expect(await store.readCache('user-a', 'things')).toBeUndefined()
  })

  it('replaces an entry in place instead of adding a second one', async () => {
    await store.writeCache('user-a', 'things', 'all', { n: 1 })
    await store.writeCache('user-a', 'things', 'all', { n: 2 })

    expect((await store.readCache('user-a', 'things'))?.data).toEqual({ n: 2 })
  })

  it('keeps different scopes of one entity apart', async () => {
    await store.writeCache('user-a', 'tasks', 'ws-1', ['one'])
    await store.writeCache('user-a', 'tasks', 'ws-2', ['two'])

    expect((await store.readCache('user-a', 'tasks', 'ws-1'))?.data).toEqual([
      'one',
    ])
    expect((await store.readCache('user-a', 'tasks', 'ws-2'))?.data).toEqual([
      'two',
    ])
  })

  it("never returns one account's data to another account", async () => {
    await store.writeCache('user-a', 'things', 'all', { secret: 'a' })

    expect(await store.readCache('user-b', 'things')).toBeUndefined()
    // ...while the owner still has it.
    expect(await store.readCache('user-a', 'things')).toBeDefined()
  })

  it('treats "no user" as having no cache, for reads and writes', async () => {
    await store.writeCache('', 'things', 'all', { n: 1 })

    expect(await store.readCache('', 'things')).toBeUndefined()
    // Nothing was stored under the empty user for someone else to find.
    expect(await idb.getRecord(':things:all')).toBeUndefined()
  })

  it('refuses a record whose owner disagrees with its key', async () => {
    await idb.putRecord({
      key: 'user-a:things:all',
      userId: 'user-b',
      entity: 'things',
      scopeId: 'all',
      schemaVersion: store.CACHE_SCHEMA_VERSION,
      cachedAt: 1,
      data: { n: 1 },
    })

    expect(await store.readCache('user-a', 'things')).toBeUndefined()
  })

  it('discards a record written under another schema version', async () => {
    await idb.putRecord({
      key: 'user-a:things:all',
      userId: 'user-a',
      entity: 'things',
      scopeId: 'all',
      schemaVersion: store.CACHE_SCHEMA_VERSION + 1,
      cachedAt: 1,
      data: { shapeFromAnotherBuild: true },
    })

    expect(await store.readCache('user-a', 'things')).toBeUndefined()
    // And it is removed, not just skipped, so it doesn't linger.
    expect(await idb.getRecord('user-a:things:all')).toBeUndefined()
  })
})

describe('clearAllCache', () => {
  it("removes every account's records", async () => {
    await store.writeCache('user-a', 'things', 'all', 1)
    await store.writeCache('user-b', 'things', 'all', 2)

    await store.clearAllCache()

    expect(await store.readCache('user-a', 'things')).toBeUndefined()
    expect(await store.readCache('user-b', 'things')).toBeUndefined()
  })
})

describe('reconcileCacheOwner', () => {
  it("removes the previous account's data when another signs in", async () => {
    await store.writeCache('user-a', 'things', 'all', 'a-data')

    await store.reconcileCacheOwner('user-b')
    await store.writeCache('user-b', 'things', 'all', 'b-data')

    expect(await store.readCache('user-a', 'things')).toBeUndefined()
    expect((await store.readCache('user-b', 'things'))?.data).toBe('b-data')
  })

  it("keeps the signed-in account's own data", async () => {
    await store.writeCache('user-a', 'things', 'all', 'a-data')
    await store.writeCache('user-b', 'things', 'all', 'b-data')

    await store.reconcileCacheOwner('user-a')

    expect((await store.readCache('user-a', 'things'))?.data).toBe('a-data')
    expect(await store.readCache('user-b', 'things')).toBeUndefined()
  })

  it('removes everything when nobody is signed in', async () => {
    await store.writeCache('user-a', 'things', 'all', 'a-data')

    await store.reconcileCacheOwner(null)

    expect(await store.readCache('user-a', 'things')).toBeUndefined()
  })

  it('does nothing again for the same account (tab-focus auth events)', async () => {
    await store.reconcileCacheOwner('user-a')
    // Something else's data arrives; a repeated call for the same account
    // must not rescan and remove it.
    await store.writeCache('user-b', 'things', 'all', 'b-data')

    await store.reconcileCacheOwner('user-a')

    expect(await store.readCache('user-b', 'things')).toBeDefined()
  })
})

describe('cache epoch', () => {
  it('moves whenever cached data is wiped, and only then', async () => {
    const start = store.getCacheEpoch()

    await store.writeCache('user-a', 'things', 'all', 1)
    expect(store.getCacheEpoch()).toBe(start)

    await store.clearAllCache()
    const afterClear = store.getCacheEpoch()
    expect(afterClear).toBeGreaterThan(start)

    await store.reconcileCacheOwner('user-a')
    const afterSignIn = store.getCacheEpoch()
    expect(afterSignIn).toBeGreaterThan(afterClear)

    await store.reconcileCacheOwner('user-a')
    expect(store.getCacheEpoch()).toBe(afterSignIn)
  })
})
