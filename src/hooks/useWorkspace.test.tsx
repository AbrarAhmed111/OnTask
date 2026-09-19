import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, settle } from '@/test/renderHook'
import { fakeSupabase, stubBrowser } from '@/test/fakeSupabase'
import { useWorkspace } from '@/hooks/useWorkspace'
import { clearAllCache, readCache, writeCache } from '@/lib/cache/cacheStore'

vi.mock('@/lib/supabase/client', async () => {
  const { fakeSupabase: fake } = await import('@/test/fakeSupabase')
  return { createClient: () => fake.client }
})
// The paint-first identity cache (Redux) is not what is under test here.
vi.mock('@/lib/redux/hooks', () => {
  const dispatch = () => undefined
  return { useAppDispatch: () => dispatch }
})

const ME = 'user-me'
const OTHER = 'user-other'
const STAMP = '2026-09-19T10:00:00Z'
const DETAIL = 'workspace-detail'
const LOAD_ERROR =
  "Couldn't load this workspace — it may not exist, or you may not be a member."

const userOf = (id: string) => ({
  id,
  email: `${id}@example.com`,
  fullName: id,
  avatarUrl: null,
})

const workspaceRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'ws-1',
  slug: 'team',
  type: 'shared',
  name: 'Team',
  description: null,
  owner_id: ME,
  timezone: 'UTC',
  report_time: '12:00:00',
  daily_reports_enabled: true,
  accent: 'forest',
  created_at: STAMP,
  updated_at: STAMP,
  ...overrides,
})

const memberRow = (userId: string, role: 'owner' | 'member') => ({
  id: `member-${userId}`,
  workspace_id: 'ws-1',
  user_id: userId,
  role,
  joined_at: STAMP,
  profiles: {
    full_name: userId,
    email: `${userId}@example.com`,
    avatar_url: null,
  },
})

let now = 0
beforeEach(async () => {
  vi.useFakeTimers({
    toFake: [
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'Date',
    ],
  })
  now = Date.parse('2026-09-19T12:00:00Z')
  vi.setSystemTime(now)
  stubBrowser()
  fakeSupabase.reset()
  await clearAllCache()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const mountAs = (userId: string, slug = 'team') =>
  renderHook(
    ({ id, workspaceSlug }: { id: string; workspaceSlug: string }) =>
      useWorkspace(workspaceSlug, userOf(id)),
    { id: userId, workspaceSlug: slug },
  )

function seedServer() {
  fakeSupabase.setRows('workspaces', [workspaceRow()])
  fakeSupabase.setRows('workspace_members', [
    memberRow(ME, 'owner'),
    memberRow(OTHER, 'member'),
  ])
}

// A first visit against the (fake) server, which caches what it showed.
async function firstVisit() {
  seedServer()
  const visit = mountAs(ME)
  await settle()
  expect(visit.result.current.workspace?.name).toBe('Team')
  visit.unmount()
  await settle()
}

describe('useWorkspace: loading', () => {
  it('cold start: loads the workspace and its members, and knows the role', async () => {
    seedServer()
    const hook = mountAs(ME)
    expect(hook.result.current.ready).toBe(false)

    await settle()

    expect(hook.result.current.workspace?.name).toBe('Team')
    expect(hook.result.current.members.map(m => m.userId)).toEqual([ME, OTHER])
    expect(hook.result.current.role).toBe('owner')
    expect(hook.result.current.ready).toBe(true)
    expect(hook.result.current.error).toBeNull()
  })

  it('caches the workspace under its user and remembers which workspace it is', async () => {
    await firstVisit()

    const cached = await readCache<{ workspace: { id: string } }>(
      ME,
      DETAIL,
      'team',
    )
    expect(cached?.data.workspace.id).toBe('ws-1')
  })
})

describe('useWorkspace: from the cache', () => {
  it('shows the cached workspace and members at once, without waiting for the server', async () => {
    await firstVisit()
    seedServer()
    const release = fakeSupabase.hold('workspaces')

    const hook = mountAs(ME)
    await settle()

    expect(hook.result.current.workspace?.name).toBe('Team')
    expect(hook.result.current.members).toHaveLength(2)
    expect(hook.result.current.ready).toBe(true)
    release()
  })

  it('does not take the caller’s role from the cache -- only from a member list the server confirmed', async () => {
    await firstVisit()
    seedServer()
    const release = fakeSupabase.hold('workspaces')

    const hook = mountAs(ME)
    await settle()
    // The cached members say this user is the owner...
    expect(hook.result.current.members.find(m => m.userId === ME)?.role).toBe(
      'owner',
    )
    // ...but that is a snapshot, not what they may do.
    expect(hook.result.current.role).toBeNull()

    release()
    await settle()
    expect(hook.result.current.role).toBe('owner')
  })

  it('does not offer owner rights the server no longer grants', async () => {
    await firstVisit()
    // Demoted while away.
    fakeSupabase.setRows('workspaces', [workspaceRow()])
    fakeSupabase.setRows('workspace_members', [
      memberRow(ME, 'member'),
      memberRow(OTHER, 'owner'),
    ])
    const hook = mountAs(ME)
    await settle()

    expect(hook.result.current.role).toBe('member')
    for (const render of hook.renders) expect(render.role).not.toBe('owner')
  })

  it('offline: keeps showing the cached workspace, reports it as possibly out of date, and does not replace the page', async () => {
    await firstVisit()
    fakeSupabase.failReads('workspaces', true)

    const hook = mountAs(ME)
    await settle()

    expect(hook.result.current.workspace?.name).toBe('Team')
    expect(hook.result.current.ready).toBe(true)
    // `error` replaces the whole page; a failed refresh must not.
    expect(hook.result.current.error).toBeNull()
    expect(hook.result.current.syncError).toMatch(/out-of-date/)
    expect(hook.result.current.role).toBeNull()
    for (const render of hook.renders) {
      expect(render.error).toBeNull()
      if (render.ready) expect(render.workspace?.name).toBe('Team')
    }
  })

  it('offline with nothing cached: the load error', async () => {
    fakeSupabase.failReads('workspaces', true)

    const hook = mountAs(ME)
    await settle()

    expect(hook.result.current.workspace).toBeNull()
    expect(hook.result.current.error).toBe(LOAD_ERROR)
  })

  it('a member list that cannot be read does not block the workspace, and leaves the role unknown', async () => {
    seedServer()
    fakeSupabase.failReads('workspace_members', true)

    const hook = mountAs(ME)
    await settle()

    expect(hook.result.current.workspace?.name).toBe('Team')
    expect(hook.result.current.ready).toBe(true)
    expect(hook.result.current.role).toBeNull()
  })
})

describe('useWorkspace: access is revoked', () => {
  it('the server no longer returns the workspace: the page shows the error, and nothing cached for it survives', async () => {
    await firstVisit()
    // Other things cached for the same workspace, and for a different one.
    await writeCache(ME, 'tasks', 'ws-1', [], 'ws-1')
    await writeCache(ME, 'goals', 'ws-1', [], 'ws-1')
    await writeCache(ME, 'tasks', 'ws-2', [], 'ws-2')
    fakeSupabase.setRows('workspaces', []) // removed / deleted / hidden by RLS

    const hook = mountAs(ME)
    await settle()

    expect(hook.result.current.error).toBe(LOAD_ERROR)
    expect(hook.result.current.workspace).toBeNull()
    expect(hook.result.current.members).toEqual([])
    expect(hook.result.current.ready).toBe(true)
    // Gone from disk, so it cannot reappear on the next visit...
    expect(await readCache(ME, DETAIL, 'team')).toBeUndefined()
    expect(await readCache(ME, 'tasks', 'ws-1')).toBeUndefined()
    expect(await readCache(ME, 'goals', 'ws-1')).toBeUndefined()
    // ...without touching a workspace the user still has.
    expect(await readCache(ME, 'tasks', 'ws-2')).toBeDefined()
  })

  it('is not re-cached by the refusal itself', async () => {
    await firstVisit()
    fakeSupabase.setRows('workspaces', [])

    const hook = mountAs(ME)
    await settle()
    hook.unmount()
    await settle()

    expect(await readCache(ME, DETAIL, 'team')).toBeUndefined()
  })

  it('removed while the workspace is open: the member list no longer includes the caller', async () => {
    seedServer()
    const hook = mountAs(ME)
    await settle()
    expect(hook.result.current.workspace).not.toBeNull()
    await writeCache(ME, 'tasks', 'ws-1', [], 'ws-1')

    // The owner removes this user; row-level security now hides the member list.
    fakeSupabase.setRows('workspace_members', [memberRow(OTHER, 'owner')])
    act(() => fakeSupabase.emit('workspace_members', { eventType: 'DELETE' }))
    await settle()

    expect(hook.result.current.error).toBe(LOAD_ERROR)
    expect(hook.result.current.workspace).toBeNull()
    expect(await readCache(ME, DETAIL, 'team')).toBeUndefined()
    expect(await readCache(ME, 'tasks', 'ws-1')).toBeUndefined()
  })

  it('a failed member refresh is not mistaken for being removed', async () => {
    seedServer()
    const hook = mountAs(ME)
    await settle()

    fakeSupabase.failReads('workspace_members', true) // offline
    act(() => fakeSupabase.emit('workspace_members', { eventType: 'UPDATE' }))
    await settle()

    expect(hook.result.current.error).toBeNull()
    expect(hook.result.current.workspace?.name).toBe('Team')
    expect(hook.result.current.role).toBe('owner')
  })

  it('a member joining is applied to the list and the cache', async () => {
    seedServer()
    const hook = mountAs(ME)
    await settle()

    fakeSupabase.setRows('workspace_members', [
      memberRow(ME, 'owner'),
      memberRow(OTHER, 'member'),
      memberRow('user-new', 'member'),
    ])
    act(() => fakeSupabase.emit('workspace_members', { eventType: 'INSERT' }))
    await settle()
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    await settle()

    expect(hook.result.current.members).toHaveLength(3)
    const cached = await readCache<{ members: unknown[] }>(ME, DETAIL, 'team')
    expect(cached?.data.members).toHaveLength(3)
  })
})

describe('useWorkspace: account isolation', () => {
  it("never shows one account's cached workspace to another account, on any render", async () => {
    await firstVisit() // ME's copy of "team" is now on disk
    fakeSupabase.setRows('workspaces', []) // user-other cannot see it
    fakeSupabase.hold('workspaces')

    const hook = mountAs('user-someone-else')
    await settle()
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    await settle()

    for (const render of hook.renders) {
      expect(render.workspace).toBeNull()
      expect(render.members).toEqual([])
      expect(render.role).toBeNull()
    }
  })

  it("switching account in place shows nothing of the previous account's workspace", async () => {
    seedServer()
    const hook = mountAs(ME)
    await settle()
    expect(hook.result.current.workspace?.name).toBe('Team')

    hook.renders.length = 0
    fakeSupabase.setRows('workspaces', [])
    hook.rerender({ id: 'user-someone-else', workspaceSlug: 'team' })
    await settle()

    for (const render of hook.renders) {
      expect(render.workspace?.name).not.toBe('Team')
      expect(render.role).toBeNull()
    }
  })

  it('the personal-workspace alias is the same URL for everyone but never shares a cache', async () => {
    const personal = (owner: string, name: string) =>
      workspaceRow({
        id: `personal-${owner}`,
        slug: `personal-${owner}`,
        type: 'personal',
        name,
        owner_id: owner,
      })
    fakeSupabase.setRows('workspaces', [
      personal(ME, 'MY-PRIVATE-WORKSPACE'),
      personal('user-other', 'THEIR-WORKSPACE'),
    ])
    fakeSupabase.setRows('workspace_members', [
      { ...memberRow(ME, 'owner'), workspace_id: `personal-${ME}` },
      {
        ...memberRow('user-other', 'owner'),
        workspace_id: 'personal-user-other',
      },
    ])
    const mine = mountAs(ME, 'personal-workspace')
    await settle()
    expect(mine.result.current.workspace?.name).toBe('MY-PRIVATE-WORKSPACE')
    mine.unmount()
    await settle()

    // Someone else opens the identical URL, the server is slow.
    const release = fakeSupabase.hold('workspaces')
    const theirs = mountAs('user-other', 'personal-workspace')
    await settle()
    for (const render of theirs.renders) {
      expect(render.workspace?.name).not.toBe('MY-PRIVATE-WORKSPACE')
    }
    release()
    await settle()
    expect(theirs.result.current.workspace?.name).toBe('THEIR-WORKSPACE')
  })
})
