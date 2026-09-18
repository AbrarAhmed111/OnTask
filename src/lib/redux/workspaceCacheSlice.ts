import { createSlice, PayloadAction } from '@reduxjs/toolkit'

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
}

const initialState: WorkspaceCacheState = { byId: {}, bySlug: {} }

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
  },
})

export const { upsertWorkspaceIdentity } = workspaceCacheSlice.actions
export default workspaceCacheSlice.reducer
