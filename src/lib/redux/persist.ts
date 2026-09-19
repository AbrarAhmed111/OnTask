import type {
  CachedWorkspaceIdentity,
  WorkspaceCacheState,
} from '@/lib/redux/workspaceCacheSlice'

// Hand-rolled localStorage persistence, matching the pattern already used
// for guest tasks/settings in src/lib/storage.ts — no redux-persist, so
// there's no extra dependency or serialization convention beyond JSON.
const WORKSPACE_CACHE_KEY = 'ontask-workspace-cache-v1'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isIdentity(value: unknown): value is CachedWorkspaceIdentity {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.slug === 'string' &&
    typeof value.name === 'string' &&
    typeof value.accent === 'string' &&
    typeof value.timezone === 'string'
  )
}

function stringValues(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {}
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  )
}

// Whatever is in storage is untrusted: it may be hand-edited, truncated, or
// written by an older build. Anything that isn't the current shape is dropped
// (an unknown accent id is fine to keep -- getWorkspaceTheme falls back to the
// default one), and each field defaults independently, so a cache from before
// `bySlug` or `personalByOwner` existed still yields the entries it has. The
// cache is only ever a paint-first hint, so losing an entry costs one default
// paint and never breaks the app.
export function parsePersistedWorkspaceCache(
  value: unknown,
): WorkspaceCacheState | undefined {
  if (!isRecord(value)) return undefined
  return {
    byId: isRecord(value.byId)
      ? (Object.fromEntries(
          Object.entries(value.byId).filter(([, identity]) =>
            isIdentity(identity),
          ),
        ) as Record<string, CachedWorkspaceIdentity>)
      : {},
    bySlug: stringValues(value.bySlug),
    personalByOwner: stringValues(value.personalByOwner),
  }
}

export function loadPersistedWorkspaceCache(): WorkspaceCacheState | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const value = window.localStorage.getItem(WORKSPACE_CACHE_KEY)
    return value ? parsePersistedWorkspaceCache(JSON.parse(value)) : undefined
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
