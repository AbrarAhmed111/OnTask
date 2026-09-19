// Where a piece of workspace data came from, kept next to the data itself.
//
// A cached copy is a *snapshot for fast rendering*, not proof of what is true
// now: a task the cache calls "working" may have been paused on another
// device an hour ago. So every list the UI shows carries an origin:
//
//   empty  nothing yet (or only changes applied to nothing)
//   cache  filled from this device's cache; may be stale
//   server confirmed by Supabase in this session (a completed fetch), and kept
//          current since by realtime events and our own writes
//
// Three separate jobs use that state, and must not blur into each other:
//   1. HYDRATING/RENDERING  -- show whatever is here, cached or not
//   2. EVALUATING           -- decide from the data whether something is due
//   3. EXECUTING            -- act on that decision (e.g. complete a task)
// Rendering (1) accepts any origin. Evaluating (2) only accepts an
// Authoritative<T>, which can only be made from a `server` snapshot (see
// authoritativeView), so cached data cannot be handed to it -- not by mistake,
// and not by a future caller who forgets to check. Nothing here performs (3).
//
// Pure and React-free, so the rules are unit-tested directly; the hook that
// drives it is hooks/useWorkspaceSnapshot.ts.

export type SnapshotOrigin = 'empty' | 'cache' | 'server'

export type SnapshotState<T> = {
  // Which user/workspace/entity this data is for. Every action carries the key
  // it was issued for and is dropped if it no longer matches, so a slow read or
  // response for a previous user or workspace can never land on the current one.
  key: string | null
  origin: SnapshotOrigin
  data: T
  // A change (a realtime event, an optimistic edit) has been applied on top of
  // `data`. A late cache read must not overwrite it.
  touched: boolean
}

export type SnapshotAction<T> =
  | { type: 'reset'; key: string | null; initial: T }
  | { type: 'hydrate'; key: string; data: T }
  | { type: 'confirm'; key: string; data: T }
  | { type: 'change'; key: string; next: T | ((current: T) => T) }

export function initialSnapshot<T>(
  key: string | null,
  initial: T,
): SnapshotState<T> {
  return { key, origin: 'empty', data: initial, touched: false }
}

export function snapshotReducer<T>(
  state: SnapshotState<T>,
  action: SnapshotAction<T>,
): SnapshotState<T> {
  if (action.type === 'reset')
    return initialSnapshot(action.key, action.initial)
  // Anything issued for another key is stale: drop it.
  if (action.key !== state.key) return state

  switch (action.type) {
    case 'hydrate':
      // The cache is only a head start. It fills a snapshot that has nothing;
      // it never replaces server data, and never replaces a change that has
      // already been applied.
      if (state.origin !== 'empty' || state.touched) return state
      return { ...state, origin: 'cache', data: action.data }
    case 'confirm':
      // A completed server read replaces everything, whatever was here.
      return { ...state, origin: 'server', data: action.data, touched: false }
    case 'change':
      // A change never upgrades the origin: an event applied on top of a cached
      // list is still a cached list until the server has answered for it.
      return {
        ...state,
        data:
          typeof action.next === 'function'
            ? (action.next as (current: T) => T)(state.data)
            : action.next,
        touched: true,
      }
  }
}

// What a consumer sees for `key`. Derived while rendering rather than reset in
// an effect, so the render right after the user or workspace changes shows
// nothing of the previous one -- not even for a frame.
export function snapshotView<T>(
  state: SnapshotState<T>,
  key: string | null,
  initial: T,
): SnapshotState<T> {
  return state.key === key ? state : initialSnapshot(key, initial)
}

declare const authoritativeBrand: unique symbol

// Data that the server has confirmed in this session. The only way to obtain
// one is authoritativeView(); functions that decide whether something must
// happen (auto-completion) take this type, never a bare array.
export type Authoritative<T> = {
  readonly data: T
  readonly [authoritativeBrand]: true
}

export function authoritativeView<T>(
  state: SnapshotState<T>,
): Authoritative<T> | null {
  return state.origin === 'server'
    ? ({ data: state.data } as Authoritative<T>)
    : null
}
