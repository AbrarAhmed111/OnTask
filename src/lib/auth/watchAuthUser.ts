import {
  isAuthRetryableFetchError,
  type SupabaseClient,
} from '@supabase/supabase-js'
import { AuthUser, toAuthUser } from '@/lib/auth/authUser'
import { reconcileCacheOwner } from '@/lib/cache/cacheStore'

// Who is signed in, from two sources of different strength:
//
//  - the LOCAL session (onAuthStateChange's INITIAL_SESSION, and every later
//    sign-in / sign-out event): read from browser storage with no network, so
//    it is available immediately, even offline;
//  - the SERVER check (getUser()): a network round trip that confirms the
//    session is still valid (not revoked, account not deleted).
//
// The local session is what the UI renders from. The server check only ever
// corrects it -- and only when the server actually answered. Offline (or with
// the auth server down), getUser() reports "no user" together with a retryable
// error, which says nothing about who is signed in; treating it as a sign-out
// would bounce an offline user off every page and wipe the local cache exactly
// when they need it.
//
// Kept apart from the React hook so those rules can be tested directly.
export type AuthWatcher = {
  // The signed-in user changed (or was established). `null` = signed out.
  onUser: (user: AuthUser | null) => void
  onPasswordRecovery: () => void
  // The server has answered about the session (any answer but "unreachable").
  onServerChecked: () => void
}

type AuthClient = Pick<SupabaseClient['auth'], 'getUser' | 'onAuthStateChange'>

// Returns the function that stops watching.
export function watchAuthUser(auth: AuthClient, watcher: AuthWatcher) {
  let active = true

  auth.getUser().then(({ data, error }) => {
    if (!active) return
    if (isAuthRetryableFetchError(error)) return

    const user = toAuthUser(data.user)
    // Before anyone can read the local cache as this user, make sure it holds
    // nobody else's data (a different account signed in last, or a session that
    // ended without a logout). Idempotent per page load.
    void reconcileCacheOwner(user?.id ?? null)
    watcher.onUser(user)
    watcher.onServerChecked()
  })

  const {
    data: { subscription },
  } = auth.onAuthStateChange((event, session) => {
    if (!active) return
    if (event === 'PASSWORD_RECOVERY') watcher.onPasswordRecovery()

    const user = toAuthUser(session?.user ?? null)
    // A null session is only proof of a sign-out for an actual SIGNED_OUT (here
    // or in another tab). INITIAL_SESSION is also null when the stored session
    // had expired and could not be refreshed -- e.g. offline -- so it must not
    // erase the cache; the server check above settles that case when it can.
    if (user || event === 'SIGNED_OUT') {
      void reconcileCacheOwner(user?.id ?? null)
    }
    watcher.onUser(user)
  })

  return () => {
    active = false
    subscription.unsubscribe()
  }
}
