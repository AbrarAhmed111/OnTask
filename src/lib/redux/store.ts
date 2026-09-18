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
    // Default each field independently rather than trusting the persisted
    // shape outright -- a cache written by an older build (e.g. before
    // `bySlug` or `personalByOwner` existed) would otherwise leave that key
    // undefined.
    preloadedState: persistedWorkspaceCache
      ? {
          workspaceCache: {
            byId: persistedWorkspaceCache.byId ?? {},
            bySlug: persistedWorkspaceCache.bySlug ?? {},
            personalByOwner: persistedWorkspaceCache.personalByOwner ?? {},
          },
        }
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
