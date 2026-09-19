import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AuthApiError,
  AuthRetryableFetchError,
  AuthSessionMissingError,
  type User,
} from '@supabase/supabase-js'
import { watchAuthUser } from '@/lib/auth/watchAuthUser'
import { reconcileCacheOwner } from '@/lib/cache/cacheStore'

vi.mock('@/lib/cache/cacheStore', () => ({
  reconcileCacheOwner: vi.fn(async () => undefined),
}))

const alice = {
  id: 'user-a',
  email: 'alice@example.com',
  user_metadata: { full_name: 'Alice' },
} as unknown as User
const bob = {
  id: 'user-b',
  email: 'bob@example.com',
  user_metadata: {},
} as unknown as User

const aliceAuthUser = {
  id: 'user-a',
  email: 'alice@example.com',
  fullName: 'Alice',
  avatarUrl: null,
}

type UserCheck = { data: { user: User | null }; error: unknown }

// A stand-in for supabase.auth whose two answers -- the server check and the
// local-session events -- are settled by the test, in whatever order it needs.
function setup() {
  let resolveGetUser!: (result: UserCheck) => void
  const getUser = new Promise<UserCheck>(resolve => {
    resolveGetUser = resolve
  })
  let emit!: (event: string, session: { user: User } | null) => void
  const unsubscribe = vi.fn()
  const auth = {
    getUser: () => getUser,
    onAuthStateChange: (callback: typeof emit) => {
      emit = callback
      return { data: { subscription: { unsubscribe } } }
    },
  }
  const watcher = {
    onUser: vi.fn(),
    onPasswordRecovery: vi.fn(),
    onServerChecked: vi.fn(),
  }
  const stop = watchAuthUser(
    auth as unknown as Parameters<typeof watchAuthUser>[0],
    watcher,
  )
  return {
    watcher,
    stop,
    unsubscribe,
    emit: (event: string, session: { user: User } | null) =>
      emit(event, session),
    serverSays: async (result: UserCheck) => {
      resolveGetUser(result)
      await new Promise(resolve => setTimeout(resolve, 0))
    },
  }
}

const reconcile = vi.mocked(reconcileCacheOwner)

beforeEach(() => {
  reconcile.mockClear()
})

describe('watchAuthUser', () => {
  it('signs the user in from the local session without waiting for the server', () => {
    const { watcher, emit } = setup()

    emit('INITIAL_SESSION', { user: alice })

    // The server has not answered yet, and nothing needed it.
    expect(watcher.onUser).toHaveBeenCalledWith(aliceAuthUser)
    expect(watcher.onServerChecked).not.toHaveBeenCalled()
    expect(reconcile).toHaveBeenCalledWith('user-a')
  })

  it('confirms the user when the server agrees', async () => {
    const { watcher, emit, serverSays } = setup()
    emit('INITIAL_SESSION', { user: alice })

    await serverSays({ data: { user: alice }, error: null })

    expect(watcher.onUser).toHaveBeenLastCalledWith(aliceAuthUser)
    expect(watcher.onServerChecked).toHaveBeenCalledTimes(1)
  })

  it('offline: an unreachable server does not sign the user out or wipe their cache', async () => {
    const { watcher, emit, serverSays } = setup()
    emit('INITIAL_SESSION', { user: alice })

    await serverSays({
      data: { user: null },
      error: new AuthRetryableFetchError('Failed to fetch', 0),
    })

    // Still exactly the one call from the local session -- never a null.
    expect(watcher.onUser).toHaveBeenCalledTimes(1)
    expect(watcher.onUser).toHaveBeenCalledWith(aliceAuthUser)
    expect(reconcile).not.toHaveBeenCalledWith(null)
    expect(watcher.onServerChecked).not.toHaveBeenCalled()
  })

  it.each([
    ['there is no session', new AuthSessionMissingError()],
    [
      'the server rejects the session',
      new AuthApiError('invalid JWT', 401, 'bad_jwt'),
    ],
  ])('signs out and wipes the cache when %s', async (_case, error) => {
    const { watcher, emit, serverSays } = setup()
    emit('INITIAL_SESSION', { user: alice })

    await serverSays({ data: { user: null }, error })

    expect(watcher.onUser).toHaveBeenLastCalledWith(null)
    expect(reconcile).toHaveBeenLastCalledWith(null)
    expect(watcher.onServerChecked).toHaveBeenCalledTimes(1)
  })

  it('does not wipe the cache for an INITIAL_SESSION that is null (e.g. expired and offline)', () => {
    const { watcher, emit } = setup()

    emit('INITIAL_SESSION', null)

    expect(watcher.onUser).toHaveBeenCalledWith(null)
    expect(reconcile).not.toHaveBeenCalled()
  })

  it('wipes the cache when the user signs out (here or in another tab)', () => {
    const { watcher, emit } = setup()
    emit('INITIAL_SESSION', { user: alice })

    emit('SIGNED_OUT', null)

    expect(watcher.onUser).toHaveBeenLastCalledWith(null)
    expect(reconcile).toHaveBeenLastCalledWith(null)
  })

  it('moves the cache to the new account when another one signs in', () => {
    const { emit } = setup()
    emit('INITIAL_SESSION', { user: alice })

    emit('SIGNED_IN', { user: bob })

    expect(reconcile).toHaveBeenLastCalledWith('user-b')
  })

  it('reports a password-recovery session and still signs the user in', () => {
    const { watcher, emit } = setup()

    emit('PASSWORD_RECOVERY', { user: alice })

    expect(watcher.onPasswordRecovery).toHaveBeenCalledTimes(1)
    expect(watcher.onUser).toHaveBeenCalledWith(aliceAuthUser)
  })

  it('stops reporting once stopped, and unsubscribes', async () => {
    const { watcher, emit, stop, unsubscribe, serverSays } = setup()

    stop()
    emit('SIGNED_IN', { user: alice })
    await serverSays({ data: { user: alice }, error: null })

    expect(unsubscribe).toHaveBeenCalledTimes(1)
    expect(watcher.onUser).not.toHaveBeenCalled()
    expect(watcher.onServerChecked).not.toHaveBeenCalled()
    expect(reconcile).not.toHaveBeenCalled()
  })
})
