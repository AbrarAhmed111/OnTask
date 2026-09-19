// The lowest layer of the local cache: one IndexedDB database with one object
// store of JSON-able records. Nothing here knows what a workspace or a task
// is -- see cacheStore.ts for the typed, per-user API on top of it, and
// project_document/local-cache.md for why the cache exists at all.
//
// The cache is a convenience, never load-bearing: IndexedDB can be missing
// (SSR, some private modes), blocked, full, or deleted by the browser at any
// moment. So every operation here resolves -- to `undefined` or a no-op --
// instead of throwing, and the app simply behaves as if it had a cold cache.

const DB_NAME = 'ontask-cache'
// The shape of the database itself (store + index names). Bumping it drops the
// old store and rebuilds it empty, which is always safe for a cache. The shape
// of what is *stored* is versioned separately, per record (CACHE_SCHEMA_VERSION
// in cacheStore.ts), so a payload change doesn't need a database upgrade.
const DB_VERSION = 1
const STORE = 'entries'
const BY_USER = 'byUser'

export type CacheRecord = {
  // `${userId}:${entity}:${scopeId}` -- see cacheKey().
  key: string
  // Indexed, so one account's records can be found (and removed) without
  // reading everyone's.
  userId: string
  entity: string
  scopeId: string
  schemaVersion: number
  // When this device last stored it, in epoch ms. Not a server timestamp.
  cachedAt: number
  data: unknown
}

let dbPromise: Promise<IDBDatabase | null> | null = null

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)

  dbPromise = new Promise<IDBDatabase | null>(resolve => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      request.onupgradeneeded = () => {
        const db = request.result
        if (db.objectStoreNames.contains(STORE)) db.deleteObjectStore(STORE)
        const store = db.createObjectStore(STORE, { keyPath: 'key' })
        store.createIndex(BY_USER, 'userId')
      }
      request.onsuccess = () => {
        const db = request.result
        // Another tab is upgrading the database (a newer build): let it, and
        // reopen on next use rather than blocking it forever.
        db.onversionchange = () => {
          db.close()
          dbPromise = null
        }
        db.onclose = () => {
          dbPromise = null
        }
        resolve(db)
      }
      request.onerror = () => resolve(null)
      request.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  }).then(db => {
    // A failed open must be retried on the next call, not remembered forever.
    if (!db) dbPromise = null
    return db
  })
  return dbPromise
}

// Runs `work` inside one transaction and resolves with its result once the
// transaction has committed (not merely when the request succeeded), so a
// caller that awaits a write can rely on it being durable.
async function run<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest | void,
  fallback: T,
): Promise<T> {
  const db = await openDb()
  if (!db) return fallback
  return new Promise<T>(resolve => {
    try {
      const transaction = db.transaction(STORE, mode)
      const request = work(transaction.objectStore(STORE))
      transaction.oncomplete = () =>
        resolve(request ? (request.result as T) : fallback)
      transaction.onerror = () => resolve(fallback)
      transaction.onabort = () => resolve(fallback)
    } catch {
      resolve(fallback)
    }
  })
}

export function getRecord(key: string): Promise<CacheRecord | undefined> {
  return run<CacheRecord | undefined>(
    'readonly',
    store => store.get(key),
    undefined,
  )
}

export async function putRecord(record: CacheRecord): Promise<void> {
  await run<unknown>('readwrite', store => store.put(record), undefined)
}

export async function deleteRecord(key: string): Promise<void> {
  await run<unknown>('readwrite', store => store.delete(key), undefined)
}

export async function clearRecords(): Promise<void> {
  await run<unknown>('readwrite', store => store.clear(), undefined)
}

// Deletes every record that does NOT belong to `userId`.
export async function deleteRecordsExceptUser(userId: string): Promise<void> {
  await run<unknown>(
    'readwrite',
    store => {
      const cursorRequest = store.index(BY_USER).openKeyCursor()
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result
        if (!cursor) return
        if (cursor.key !== userId) store.delete(cursor.primaryKey)
        cursor.continue()
      }
    },
    undefined,
  )
}
