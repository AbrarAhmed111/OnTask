import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, settle } from '@/test/renderHook'
import { fakeSupabase, stubBrowser } from '@/test/fakeSupabase'
import { useWorkspaceGoals } from '@/hooks/useWorkspaceGoals'
import { useWorkspaceActivity } from '@/hooks/useWorkspaceActivity'
import { useWorkspaceResources } from '@/hooks/useWorkspaceResources'
import { useTaskNotes } from '@/hooks/useTaskNotes'
import { useNotifications } from '@/hooks/useNotifications'
import { useWorkspaceSummary } from '@/hooks/useWorkspaceSummary'
import { clearAllCache, clearWorkspaceCache } from '@/lib/cache/cacheStore'

vi.mock('@/lib/supabase/client', async () => {
  const { fakeSupabase: fake } = await import('@/test/fakeSupabase')
  return { createClient: () => fake.client }
})

const userOf = (id: string) => ({
  id,
  email: `${id}@example.com`,
  fullName: id,
  avatarUrl: null,
})
const ME = 'user-me'
const STAMP = '2026-09-19T10:00:00Z'

type Row = Record<string, unknown>

// One entry per cached list. `useList` runs the real hook for a user; `read`
// says what the hook returned; the rest describes the rows its table holds.
type Config = {
  name: string
  table: string
  row: (id: string, extra?: Row) => Row
  useList: (userId: string) => {
    items: { id: string }[]
    ready: boolean
    error: string | null
  }
  // Reports a failed refresh of a cached list to the user (the daily reports
  // section deliberately stays quiet, as it always has).
  reportsRefreshFailure: boolean
  // Realtime merges the event's row into the list (notifications refetch instead).
  mergesRealtime: boolean
}

// The hooks are mounted through this so every case can be written once.
function harness(config: Config) {
  return (userId: string) =>
    renderHook(({ id }: { id: string }) => config.useList(id), { id: userId })
}

const configs: Config[] = [
  {
    name: 'goals',
    table: 'goals',
    row: (id, extra) => ({
      id,
      workspace_id: 'ws-1',
      name: `Goal ${id}`,
      description: null,
      status: 'active',
      created_by: ME,
      target_date: null,
      position: 1000,
      created_at: STAMP,
      updated_at: STAMP,
      completed_at: null,
      archived_at: null,
      ...extra,
    }),
    useList: userId => {
      const r = useWorkspaceGoals('ws-1', userOf(userId))
      return { items: r.goals, ready: r.ready, error: r.error }
    },
    reportsRefreshFailure: true,
    mergesRealtime: true,
  },
  {
    name: 'recent activity',
    table: 'task_events',
    row: (id, extra) => ({
      id,
      workspace_id: 'ws-1',
      task_id: 'task-1',
      goal_id: null,
      actor_id: ME,
      event_type: 'started',
      metadata: {},
      created_at: `2026-09-19T10:00:${id.slice(-2).padStart(2, '0')}Z`,
      ...extra,
    }),
    useList: userId => {
      const r = useWorkspaceActivity('ws-1', userOf(userId))
      return { items: r.events, ready: r.ready, error: r.error }
    },
    reportsRefreshFailure: true,
    mergesRealtime: true,
  },
  {
    name: 'resource metadata',
    table: 'workspace_resources',
    row: (id, extra) => ({
      id,
      workspace_id: 'ws-1',
      goal_id: null,
      uploaded_by: ME,
      file_name: `${id}.pdf`,
      file_type: 'application/pdf',
      file_size: 1234,
      storage_path: `ws-1/${id}/${id}.pdf`,
      description: null,
      created_at: STAMP,
      updated_at: STAMP,
      ...extra,
    }),
    useList: userId => {
      const r = useWorkspaceResources('ws-1', userOf(userId))
      return { items: r.resources, ready: r.ready, error: r.error }
    },
    reportsRefreshFailure: true,
    mergesRealtime: true,
  },
  {
    name: 'task notes',
    table: 'task_notes',
    row: (id, extra) => ({
      id,
      task_id: 'task-1',
      author_id: ME,
      content: `Note ${id}`,
      created_at: `2026-09-19T10:00:${id.slice(-2).padStart(2, '0')}Z`,
      updated_at: STAMP,
      ...extra,
    }),
    useList: userId => {
      const r = useTaskNotes('task-1', userOf(userId), 'ws-1')
      return { items: r.notes, ready: r.ready, error: r.error }
    },
    reportsRefreshFailure: true,
    mergesRealtime: true,
  },
  {
    name: 'daily reports',
    table: 'workspace_daily_summaries',
    row: (id, extra) => ({
      id,
      workspace_id: 'ws-1',
      report_start: '2026-09-18T12:00:00Z',
      report_end: `2026-09-19T12:00:${id.slice(-2).padStart(2, '0')}Z`,
      report_timezone: 'UTC',
      version: 1,
      structured_snapshot: {},
      narrative: { overall_summary: `Report ${id}` },
      meta: {},
      generation_type: 'automatic',
      generation_status: 'completed',
      generated_by: null,
      generated_at: STAMP,
      regenerated_by: null,
      regenerated_at: null,
      created_at: STAMP,
      ...extra,
    }),
    useList: userId => {
      const r = useWorkspaceSummary(
        'ws-1',
        userOf(userId),
        'UTC',
        '12:00:00',
        true,
      )
      // `error` is the regenerate banner: a load failure never lands there.
      return { items: r.history, ready: r.ready, error: r.error }
    },
    reportsRefreshFailure: false,
    mergesRealtime: true,
  },
  {
    name: 'notifications',
    table: 'notifications',
    row: (id, extra) => ({
      id,
      user_id: ME,
      workspace_id: 'ws-1',
      event_id: null,
      goal_id: null,
      notification_type: 'assigned',
      entity_type: 'task',
      entity_id: null,
      title: `Notification ${id}`,
      body: null,
      actor_id: null,
      read_at: null,
      created_at: STAMP,
      workspaces: {
        slug: 'team',
        type: 'shared',
        name: 'Team',
        accent: 'forest',
      },
      ...extra,
    }),
    useList: userId => {
      const r = useNotifications(userOf(userId), {
        kind: 'shared',
        workspaceId: 'ws-1',
      })
      return { items: r.notifications, ready: r.ready, error: r.error }
    },
    reportsRefreshFailure: true,
    mergesRealtime: false,
  },
]

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
  vi.setSystemTime(Date.parse('2026-09-19T12:00:00Z'))
  stubBrowser()
  fakeSupabase.reset()
  await clearAllCache()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const ids = (items: { id: string }[]) => items.map(item => item.id).sort()

describe.each(configs)('cached list: $name', config => {
  const mountAs = harness(config)
  // The rows belong to ME; other accounts see none of them from the server, so
  // whatever another account shows can only have come from the cache.
  const seedServer = (...rowIds: string[]) =>
    fakeSupabase.setRows(
      config.table,
      rowIds.map(id => config.row(id)),
    )

  // Runs the hook once against the real (fake) server, so it caches what it
  // showed -- the way a first visit would -- and leaves.
  async function firstVisit(...rowIds: string[]) {
    seedServer(...rowIds)
    const visit = mountAs(ME)
    await settle()
    expect(ids(visit.result.current.items)).toEqual([...rowIds].sort())
    visit.unmount()
    await settle()
  }

  it('cold start shows the server list; a later visit shows it at once from the cache', async () => {
    await firstVisit('a-01', 'b-02')

    seedServer('a-01', 'b-02', 'c-03') // the server has moved on...
    const release = fakeSupabase.hold(config.table) // ...but has not answered yet
    const visit = mountAs(ME)
    await settle()

    expect(ids(visit.result.current.items)).toEqual(['a-01', 'b-02'])
    expect(visit.result.current.ready).toBe(true) // no skeleton over known content

    release()
    await settle()
    expect(ids(visit.result.current.items)).toEqual(['a-01', 'b-02', 'c-03'])
  })

  it('is cached under this user AND this workspace, so losing the workspace removes it', async () => {
    await firstVisit('a-01', 'b-02')

    // Access to another workspace is lost: this one's cache is untouched.
    await clearWorkspaceCache(ME, 'some-other-workspace')
    seedServer('a-01', 'b-02')
    fakeSupabase.hold(config.table)
    const kept = mountAs(ME)
    await settle()
    expect(ids(kept.result.current.items)).toEqual(['a-01', 'b-02'])
    kept.unmount()
    await settle()

    // Access to THIS workspace is lost: nothing of it can come back from disk.
    await clearWorkspaceCache(ME, 'ws-1')
    const gone = mountAs(ME)
    await settle()
    expect(gone.result.current.items).toEqual([])
  })

  it('an item removed on the server disappears once the server answers', async () => {
    await firstVisit('a-01', 'b-02')

    seedServer('a-01')
    const visit = mountAs(ME)
    await settle()

    expect(ids(visit.result.current.items)).toEqual(['a-01'])
  })

  it('offline: keeps the cached list on screen, and says so when it matters', async () => {
    await firstVisit('a-01', 'b-02')

    fakeSupabase.failReads(config.table, true)
    const visit = mountAs(ME)
    await settle()

    expect(ids(visit.result.current.items)).toEqual(['a-01', 'b-02'])
    expect(visit.result.current.ready).toBe(true)
    if (config.reportsRefreshFailure) {
      expect(visit.result.current.error).toMatch(/out-of-date|older/)
    } else {
      expect(visit.result.current.error).toBeNull()
    }
    // Not even for one render: the cached list is never replaced by a
    // "couldn't load" state or an empty ready list.
    for (const render of visit.renders) {
      if (render.ready) expect(ids(render.items)).toEqual(['a-01', 'b-02'])
      if (render.error) expect(render.error).not.toMatch(/^Couldn't load/)
    }
  })

  it('offline with nothing cached: an empty list, and the plain load error where it reports one', async () => {
    fakeSupabase.failReads(config.table, true)
    const visit = mountAs(ME)
    await settle()

    expect(visit.result.current.items).toEqual([])
    expect(visit.result.current.ready).toBe(true)
    if (config.reportsRefreshFailure) {
      expect(visit.result.current.error).toMatch(/^Couldn't load/)
    }
  })

  it("never shows one account's cached list to another account, on any render", async () => {
    await firstVisit('secret-01')

    fakeSupabase.setRows(config.table, [])
    fakeSupabase.hold(config.table)
    const visit = mountAs('user-someone-else')
    await settle()
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    await settle()

    for (const render of visit.renders) {
      expect(ids(render.items)).not.toContain('secret-01')
    }
  })

  it("switching account in place shows nothing of the previous account's list", async () => {
    seedServer('mine-01')
    const visit = renderHook(({ id }: { id: string }) => config.useList(id), {
      id: ME,
    })
    await settle()
    expect(ids(visit.result.current.items)).toEqual(['mine-01'])

    visit.renders.length = 0
    fakeSupabase.setRows(config.table, [])
    visit.rerender({ id: 'user-someone-else' })
    await settle()

    for (const render of visit.renders) {
      expect(ids(render.items)).not.toContain('mine-01')
    }
  })

  it('a realtime event is applied to the screen and to the cache', async function () {
    if (!config.mergesRealtime) return // refetches instead; covered by "later visit"
    await firstVisit('a-01')

    seedServer('a-01')
    const visit = mountAs(ME)
    await settle()
    act(() =>
      fakeSupabase.emit(config.table, {
        eventType: 'INSERT',
        new: config.row('z-09'),
      }),
    )
    expect(ids(visit.result.current.items)).toContain('z-09')
    visit.unmount()
    await settle()

    // Next visit, server slow: the event is already in the cached copy.
    fakeSupabase.setRows(config.table, [config.row('a-01'), config.row('z-09')])
    fakeSupabase.hold(config.table)
    const next = mountAs(ME)
    await settle()
    expect(ids(next.result.current.items)).toEqual(['a-01', 'z-09'])
  })

  it('does not add an item twice when the same row arrives by fetch and by realtime', async function () {
    if (!config.mergesRealtime) return
    seedServer('a-01')
    const visit = mountAs(ME)
    await settle()

    act(() =>
      fakeSupabase.emit(config.table, {
        eventType: 'INSERT',
        new: config.row('a-01'),
      }),
    )

    expect(ids(visit.result.current.items)).toEqual(['a-01'])
  })
})
