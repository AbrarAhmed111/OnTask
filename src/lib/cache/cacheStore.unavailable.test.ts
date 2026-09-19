import { describe, expect, it } from 'vitest'
import {
  clearAllCache,
  readCache,
  reconcileCacheOwner,
  writeCache,
} from '@/lib/cache/cacheStore'

// vitest runs in Node here, which has no IndexedDB -- exactly the situation of
// server rendering or a browser that blocks storage. The cache must degrade to
// "always cold", never throw.
describe('when IndexedDB is unavailable', () => {
  it('reads as an empty cache', async () => {
    expect(typeof indexedDB).toBe('undefined')
    expect(await readCache('user-a', 'things')).toBeUndefined()
  })

  it('accepts writes and wipes without failing', async () => {
    await expect(writeCache('user-a', 'things', 'all', 1)).resolves.toBe(
      undefined,
    )
    await expect(clearAllCache()).resolves.toBe(undefined)
    await expect(reconcileCacheOwner('user-a')).resolves.toBe(undefined)
  })
})
