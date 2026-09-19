import { configureStore } from '@reduxjs/toolkit'
import workspaceCacheReducer from '@/lib/redux/workspaceCacheSlice'
import {
  loadPersistedWorkspaceCache,
  savePersistedWorkspaceCache,
} from '@/lib/redux/persist'

export function makeStore() {
  const persistedWorkspaceCache = loadPersistedWorkspaceCache()

  const store = configureStore({
    reducer: {
      workspaceCache: workspaceCacheReducer,
    },
    // Already validated and defaulted field by field (see persist.ts), so a
    // cache from an older build or a damaged one can't reach the reducers.
    preloadedState: persistedWorkspaceCache
      ? { workspaceCache: persistedWorkspaceCache }
      : undefined,
  })

  store.subscribe(() => {
    savePersistedWorkspaceCache(store.getState().workspaceCache)
  })

  return store
}

export type AppStore = ReturnType<typeof makeStore>
export type RootState = ReturnType<AppStore['getState']>
export type AppDispatch = AppStore['dispatch']
