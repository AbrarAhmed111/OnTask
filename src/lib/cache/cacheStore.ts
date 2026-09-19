import {
  clearRecords,
  deleteRecord,
  deleteRecordsExceptUser,
  deleteRecordsForWorkspace,
  getRecord,
  putRecord,
} from '@/lib/cache/idb'

// The local cache of application data. Ground rules (local-cache.md §7, §11):
//
//  - Supabase is the source of truth; what is stored here is a snapshot that
//    may be stale. It is only ever used to paint something sooner -- never to
//    decide who may see or do anything. RLS and the server stay authoritative.
//  - Every record belongs to exactly one signed-in user, and every read names
//    that user, so one account's data can't be returned for another.
//  - Nothing secret is stored here (no tokens, no keys) -- only rows the user
//    could already read from Supabase.
//
// Theme/accent stays out of this store on purpose: it has to be readable
// synchronously before first paint, which IndexedDB can't do (see
// lib/redux/persist.ts, which is the localStorage half of the picture).

// Bump when the SHAPE of a stored payload changes incompatibly. A record
// written under any other version is treated as missing and removed, so an old
// build's data can never reach code that expects the new shape.
export const CACHE_SCHEMA_VERSION = 1

export type CacheHit<T> = { data: T; cachedAt: number }

// Incremented every time cached data is wiped (logout, account change).
// Anything that started before a wipe compares the epoch before writing, so a
// response that lands *after* logout can't put the old user's data back.
let epoch = 0
export function getCacheEpoch(): number {
  return epoch
}

// Who the records currently in this browser belong to, as far as this page
// load has established. `undefined` = not yet reconciled.
let owner: string | null | undefined

function cacheKey(userId: string, entity: string, scopeId: string) {
  // userId is a uuid and entity a fixed name, so neither contains ':'; scopeId
  // is last, so whatever it contains the key stays unambiguous.
  return `${userId}:${entity}:${scopeId}`
}

// `scopeId` narrows an entity to one workspace/goal/task where that applies;
// entities that exist once per user use the default.
export async function readCache<T>(
  userId: string,
  entity: string,
  scopeId = 'all',
): Promise<CacheHit<T> | undefined> {
  if (!userId) return undefined
  const record = await getRecord(cacheKey(userId, entity, scopeId))
  if (!record) return undefined
  // Belt and braces: the key already embeds the user, but a record that
  // somehow disagrees with it is never returned.
  if (record.userId !== userId) return undefined
  if (record.schemaVersion !== CACHE_SCHEMA_VERSION) {
    // Written by another build; it can't be trusted to have today's shape.
    // Dropping it costs one cold load, which is exactly what it would cost
    // anyway.
    void deleteRecord(record.key)
    return undefined
  }
  return { data: record.data as T, cachedAt: record.cachedAt }
}

// `workspaceId` says which workspace the record belongs to (when it belongs to
// one), so clearWorkspaceCache can drop it with the rest. It is bookkeeping for
// invalidation, separate from `scopeId`, which is only part of the lookup key.
export async function writeCache<T>(
  userId: string,
  entity: string,
  scopeId: string,
  data: T,
  workspaceId: string | null = null,
): Promise<void> {
  if (!userId) return
  await putRecord({
    key: cacheKey(userId, entity, scopeId),
    userId,
    workspaceId,
    entity,
    scopeId,
    schemaVersion: CACHE_SCHEMA_VERSION,
    cachedAt: Date.now(),
    data,
  })
}

// Removes one entry. Moves the epoch like every other removal, so a write that
// was already scheduled for it cannot put it back.
export async function deleteCache(
  userId: string,
  entity: string,
  scopeId = 'all',
): Promise<void> {
  if (!userId) return
  epoch += 1
  await deleteRecord(cacheKey(userId, entity, scopeId))
}

// The user no longer has access to this workspace (it was deleted, they left
// or were removed, or the server says they can't see it): everything cached
// for it goes, so it can't be shown again from disk. Moves the epoch like any
// other wipe, so a response that was already in flight can't write it back.
export async function clearWorkspaceCache(
  userId: string,
  workspaceId: string,
): Promise<void> {
  if (!userId || !workspaceId) return
  epoch += 1
  await deleteRecordsForWorkspace(userId, workspaceId)
}

// Signed out: nothing of the previous session's is left on the device.
export async function clearAllCache(): Promise<void> {
  epoch += 1
  owner = null
  await clearRecords()
}

// Called whenever the signed-in user is (re)established. Keeps at most one
// account's data on the device:
//
//   signed in as A  -> anything that isn't A's is removed (account switch, or
//                      a session that ended without an explicit logout)
//   signed out      -> everything is removed
//
// It is a no-op when the owner hasn't changed, so the tab-focus auth events
// that fire this repeatedly don't rescan the store each time.
export async function reconcileCacheOwner(userId: string | null) {
  if (owner === userId) return
  owner = userId
  epoch += 1
  if (userId) await deleteRecordsExceptUser(userId)
  else await clearRecords()
}
