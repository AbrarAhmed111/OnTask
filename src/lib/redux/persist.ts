import type { WorkspaceCacheState } from '@/lib/redux/workspaceCacheSlice'

// Hand-rolled localStorage persistence, matching the pattern already used
// for guest tasks/settings in src/lib/storage.ts — no redux-persist, so
// there's no extra dependency or serialization convention beyond JSON.
const WORKSPACE_CACHE_KEY = 'ontask-workspace-cache-v1'

export function loadPersistedWorkspaceCache(): WorkspaceCacheState | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const value = window.localStorage.getItem(WORKSPACE_CACHE_KEY)
    return value ? (JSON.parse(value) as WorkspaceCacheState) : undefined
  } catch {
    return undefined
  }
}

export function savePersistedWorkspaceCache(state: WorkspaceCacheState) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(WORKSPACE_CACHE_KEY, JSON.stringify(state))
  } catch {
    // Caching is an optimization, never load-bearing — quota errors or
    // private-mode storage restrictions should just no-op.
  }
}
