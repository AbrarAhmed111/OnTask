import { describe, expect, it } from 'vitest'
import reducer, {
  CachedWorkspaceIdentity,
  WorkspaceCacheState,
  selectCachedWorkspaceIdentity,
  upsertPersonalWorkspaceIdentity,
  upsertWorkspaceIdentity,
} from '@/lib/redux/workspaceCacheSlice'
import { PERSONAL_WORKSPACE_SLUG } from '@/lib/workspaces'

const empty: WorkspaceCacheState = {
  byId: {},
  bySlug: {},
  personalByOwner: {},
}

const shared: CachedWorkspaceIdentity = {
  id: 'ws-shared',
  slug: 'design-team',
  name: 'Design Team',
  accent: 'ocean',
  timezone: 'Europe/London',
}

const personalOf = (id: string, accent: string): CachedWorkspaceIdentity => ({
  id,
  slug: PERSONAL_WORKSPACE_SLUG,
  name: 'Personal Workspace',
  accent,
  timezone: 'UTC',
})

describe('workspace identity cache', () => {
  it('finds a shared workspace by its resolved id or, before that, its slug', () => {
    const state = reducer(empty, upsertWorkspaceIdentity(shared))
    const lookup = (workspaceId: string) =>
      selectCachedWorkspaceIdentity(state, {
        workspaceId,
        workspaceSlug: 'design-team',
        userId: 'user-a',
      })

    expect(lookup('ws-shared')).toEqual(shared)
    expect(lookup('')).toEqual(shared)
  })

  it('finds a personal workspace by who is signed in, so its accent paints on refresh', () => {
    const state = reducer(
      empty,
      upsertPersonalWorkspaceIdentity({
        ownerId: 'user-a',
        identity: personalOf('ws-a', 'berry'),
      }),
    )

    expect(
      selectCachedWorkspaceIdentity(state, {
        workspaceId: '',
        workspaceSlug: PERSONAL_WORKSPACE_SLUG,
        userId: 'user-a',
      })?.accent,
    ).toBe('berry')
  })

  it("never paints one account's personal workspace for another account", () => {
    const state = reducer(
      empty,
      upsertPersonalWorkspaceIdentity({
        ownerId: 'user-a',
        identity: personalOf('ws-a', 'berry'),
      }),
    )

    expect(
      selectCachedWorkspaceIdentity(state, {
        workspaceId: '',
        workspaceSlug: PERSONAL_WORKSPACE_SLUG,
        userId: 'user-b',
      }),
    ).toBeUndefined()
  })

  it('keeps each account its own personal identity', () => {
    let state = reducer(
      empty,
      upsertPersonalWorkspaceIdentity({
        ownerId: 'user-a',
        identity: personalOf('ws-a', 'berry'),
      }),
    )
    state = reducer(
      state,
      upsertPersonalWorkspaceIdentity({
        ownerId: 'user-b',
        identity: personalOf('ws-b', 'sunset'),
      }),
    )
    const accentFor = (userId: string) =>
      selectCachedWorkspaceIdentity(state, {
        workspaceId: '',
        workspaceSlug: PERSONAL_WORKSPACE_SLUG,
        userId,
      })?.accent

    expect(accentFor('user-a')).toBe('berry')
    expect(accentFor('user-b')).toBe('sunset')
  })

  it('never registers a personal workspace under the shared slug alias', () => {
    const state = reducer(
      empty,
      upsertPersonalWorkspaceIdentity({
        ownerId: 'user-a',
        identity: personalOf('ws-a', 'berry'),
      }),
    )

    expect(state.bySlug).toEqual({})
  })
})
