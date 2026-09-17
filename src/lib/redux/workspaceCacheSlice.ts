import { createSlice, PayloadAction } from '@reduxjs/toolkit'

// Only the near-static identity fields a workspace page needs to paint
// correctly on first render — never member lists, tasks, or anything that
// changes often. Those stay fully network-driven; caching them risks
// showing stale realtime state (timers, assignments) after a refresh.
export type CachedWorkspaceIdentity = {
  id: string
  name: string
  accent: string
  timezone: string
}

export type WorkspaceCacheState = {
  byId: Record<string, CachedWorkspaceIdentity>
}

const initialState: WorkspaceCacheState = { byId: {} }

const workspaceCacheSlice = createSlice({
  name: 'workspaceCache',
  initialState,
  reducers: {
    upsertWorkspaceIdentity(
      state,
      action: PayloadAction<CachedWorkspaceIdentity>,
    ) {
      state.byId[action.payload.id] = action.payload
    },
  },
})

export const { upsertWorkspaceIdentity } = workspaceCacheSlice.actions
export default workspaceCacheSlice.reducer
