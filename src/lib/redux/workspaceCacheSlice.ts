import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { PERSONAL_WORKSPACE_SLUG } from '@/lib/workspaces'

// Only the near-static identity fields a workspace page needs to paint
// correctly on first render — never member lists, tasks, or anything that
// changes often. Those stay fully network-driven; caching them risks
// showing stale realtime state (timers, assignments) after a refresh.
export type CachedWorkspaceIdentity = {
  id: string
  slug: string
  name: string
  accent: string
  timezone: string
}

export type WorkspaceCacheState = {
  byId: Record<string, CachedWorkspaceIdentity>
  // Lets a direct visit to /workspaces/[slug] paint instantly from a
  // previous session's cache before the slug -> id lookup round-trips.
  bySlug: Record<string, string>
  // A personal workspace can't live in `bySlug`: its URL alias is the same
  // string for every user, so a slug key would let one account's identity
  // paint for the next account that signs in on this browser. It's keyed by
  // its owner instead, which can only ever match the signed-in user.
  personalByOwner: Record<string, string>
}

const initialState: WorkspaceCacheState = {
  byId: {},
  bySlug: {},
  personalByOwner: {},
}

const workspaceCacheSlice = createSlice({
  name: 'workspaceCache',
  initialState,
  reducers: {
    upsertWorkspaceIdentity(
      state,
      action: PayloadAction<CachedWorkspaceIdentity>,
    ) {
      state.byId[action.payload.id] = action.payload
      state.bySlug[action.payload.slug] = action.payload.id
    },
    upsertPersonalWorkspaceIdentity(
      state,
      action: PayloadAction<{
        ownerId: string
        identity: CachedWorkspaceIdentity
      }>,
    ) {
      const { ownerId, identity } = action.payload
      state.byId[identity.id] = identity
      state.personalByOwner[ownerId] = identity.id
    },
  },
})

// The cached identity to paint a workspace header from before its row has
// loaded, or undefined. A personal workspace is found by who is signed in; any
// other by its resolved id, falling back to the slug from the URL.
export function selectCachedWorkspaceIdentity(
  cache: WorkspaceCacheState,
  {
    workspaceId,
    workspaceSlug,
    userId,
  }: { workspaceId: string; workspaceSlug: string; userId: string },
): CachedWorkspaceIdentity | undefined {
  if (workspaceSlug === PERSONAL_WORKSPACE_SLUG) {
    const personalId = cache.personalByOwner[userId]
    return personalId ? cache.byId[personalId] : undefined
  }
  const cachedId = workspaceId || cache.bySlug[workspaceSlug]
  return cachedId ? cache.byId[cachedId] : undefined
}

export const { upsertWorkspaceIdentity, upsertPersonalWorkspaceIdentity } =
  workspaceCacheSlice.actions
export default workspaceCacheSlice.reducer
