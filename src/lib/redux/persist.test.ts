import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  loadPersistedWorkspaceCache,
  parsePersistedWorkspaceCache,
} from '@/lib/redux/persist'

const identity = {
  id: 'ws-1',
  slug: 'design-team',
  name: 'Design Team',
  accent: 'ocean',
  timezone: 'Europe/London',
}

describe('parsePersistedWorkspaceCache', () => {
  it('keeps a well-formed cache exactly as it was stored', () => {
    const stored = {
      byId: { 'ws-1': identity },
      bySlug: { 'design-team': 'ws-1' },
      personalByOwner: { 'user-a': 'ws-2' },
    }

    expect(parsePersistedWorkspaceCache(stored)).toEqual(stored)
  })

  it('yields nothing for stored values that are not a cache at all', () => {
    for (const value of [null, undefined, 'text', 42, true, []]) {
      expect(parsePersistedWorkspaceCache(value)).toBeUndefined()
    }
  })

  it('defaults each missing field, as a cache from an older build has', () => {
    expect(
      parsePersistedWorkspaceCache({ byId: { 'ws-1': identity } }),
    ).toEqual({
      byId: { 'ws-1': identity },
      bySlug: {},
      personalByOwner: {},
    })
  })

  it('drops a field of the wrong type instead of letting it reach the reducers', () => {
    expect(
      parsePersistedWorkspaceCache({
        byId: 'oops',
        bySlug: ['design-team'],
        personalByOwner: 7,
      }),
    ).toEqual({ byId: {}, bySlug: {}, personalByOwner: {} })
  })

  it('drops only the entries that are damaged', () => {
    const parsed = parsePersistedWorkspaceCache({
      byId: {
        'ws-1': identity,
        'ws-2': { ...identity, id: 'ws-2', accent: 42 },
        'ws-3': null,
        'ws-4': 'ocean',
      },
      bySlug: { good: 'ws-1', bad: 5 },
      personalByOwner: { 'user-a': 'ws-1', 'user-b': null },
    })

    expect(Object.keys(parsed?.byId ?? {})).toEqual(['ws-1'])
    expect(parsed?.bySlug).toEqual({ good: 'ws-1' })
    expect(parsed?.personalByOwner).toEqual({ 'user-a': 'ws-1' })
  })

  it('keeps an accent this build no longer knows -- the theme lookup falls back', () => {
    const parsed = parsePersistedWorkspaceCache({
      byId: { 'ws-1': { ...identity, accent: 'retired-theme' } },
    })

    expect(parsed?.byId['ws-1'].accent).toBe('retired-theme')
  })
})

describe('loadPersistedWorkspaceCache', () => {
  afterEach(() => vi.unstubAllGlobals())

  const withStorage = (localStorage: Pick<Storage, 'getItem'>) =>
    vi.stubGlobal('window', { localStorage })

  it('has nothing to load on the server', () => {
    expect(loadPersistedWorkspaceCache()).toBeUndefined()
  })

  it('has nothing to load when nothing was saved', () => {
    withStorage({ getItem: () => null })

    expect(loadPersistedWorkspaceCache()).toBeUndefined()
  })

  it('reads the stored cache', () => {
    withStorage({
      getItem: () => JSON.stringify({ byId: { 'ws-1': identity } }),
    })

    expect(loadPersistedWorkspaceCache()?.byId['ws-1']).toEqual(identity)
  })

  it('ignores stored text that is not JSON', () => {
    withStorage({ getItem: () => '{"byId": {"ws-1": ' })

    expect(loadPersistedWorkspaceCache()).toBeUndefined()
  })

  it('ignores storage that throws, as a blocked or private-mode browser does', () => {
    withStorage({
      getItem: () => {
        throw new DOMException('denied', 'SecurityError')
      },
    })

    expect(loadPersistedWorkspaceCache()).toBeUndefined()
  })
})
