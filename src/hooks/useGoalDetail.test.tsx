import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, settle } from '@/test/renderHook'
import {
  fakeSupabase,
  omitGuardedCompletion,
  stubBrowser,
} from '@/test/fakeSupabase'
import { useGoalDetail } from '@/hooks/useGoalDetail'
import { clearAllCache } from '@/lib/cache/cacheStore'
import type { WorkspaceTaskRow } from '@/lib/tasks/workspaceMappers'

vi.mock('@/lib/supabase/client', async () => {
  const { fakeSupabase: fake } = await import('@/test/fakeSupabase')
  return { createClient: () => fake.client }
})

const ME = 'user-me'
const user = {
  id: ME,
  email: 'me@example.com',
  fullName: 'Me',
  avatarUrl: null,
}
const NOW = Date.parse('2026-09-19T12:00:00Z')
const COMPLETE = 'complete_workspace_task'

let sequence = 0
function goalTask(overrides: Partial<WorkspaceTaskRow> = {}): WorkspaceTaskRow {
  sequence += 1
  return {
    id: `goal-task-${sequence}`,
    workspace_id: 'ws-1',
    parent_task_id: null,
    goal_id: 'goal-1',
    created_by: ME,
    assigned_to: ME,
    title: `Goal task ${sequence}`,
    planned_seconds: 60 * 60,
    actual_seconds: 0,
    status: 'working',
    progress_label: null,
    progress_percentage: null,
    started_at: new Date(NOW - 90 * 60_000 + sequence).toISOString(),
    completed_at: null,
    ...overrides,
  }
}

const completions = () =>
  fakeSupabase.rpcCalls.filter(call => call.name === COMPLETE)

let browser: ReturnType<typeof stubBrowser>

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
  vi.setSystemTime(NOW)
  browser = stubBrowser()
  fakeSupabase.reset()
  omitGuardedCompletion(fakeSupabase) // a database without migration 0043
  await clearAllCache()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const mount = (onComplete = vi.fn()) =>
  renderHook(
    () => useGoalDetail('goal-1', 'ws-1', user, [], onComplete, false),
    {},
  )

async function tick(ms = 1000) {
  await act(async () => {
    vi.advanceTimersByTime(ms)
  })
  await settle()
}

// A goal's tasks use the same completion path as the flat list (one shared
// implementation); these check the goal-specific wiring.
describe('useGoalDetail: auto-completion', () => {
  it('completes a running goal task whose time is up, once the server has confirmed it', async () => {
    const row = goalTask()
    fakeSupabase.setRows('workspace_tasks', [row])
    const onComplete = vi.fn()
    const hook = mount(onComplete)
    expect(completions()).toHaveLength(0) // nothing before the server answers

    await settle()
    await tick(1000)

    expect(completions()).toEqual([
      { name: COMPLETE, args: { p_task_id: row.id, p_skip: false } },
    ])
    expect(hook.result.current.tasks[0].status).toBe('completed')
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('a refetch that still shows the same run running does not complete it again', async () => {
    const row = goalTask()
    fakeSupabase.setRows('workspace_tasks', [row])
    mount()
    await settle()
    await tick(1000)
    expect(completions()).toHaveLength(1)

    browser.fire('visibilitychange')
    await settle()
    await tick(10_000)

    expect(completions()).toHaveLength(1)
  })

  it('does not complete a task the server says was paused elsewhere', async () => {
    const row = goalTask({
      started_at: new Date(NOW - 59 * 60_000).toISOString(),
    })
    fakeSupabase.setRows('workspace_tasks', [row])
    const hook = mount()
    await settle()
    fakeSupabase.setRows('workspace_tasks', [
      { ...row, status: 'paused', started_at: null, actual_seconds: 3540 },
    ])

    await tick(90_000)

    expect(completions()).toHaveLength(0)
    expect(hook.result.current.tasks[0].status).toBe('paused')
  })

  it("never shows the previous goal's tasks after switching goals", async () => {
    const first = goalTask({
      title: 'FIRST-GOAL-TASK',
      status: 'queued',
      started_at: null,
    })
    fakeSupabase.setRows('workspace_tasks', [first])
    const hook = renderHook(
      ({ goalId }: { goalId: string }) =>
        useGoalDetail(goalId, 'ws-1', user, [], undefined, false),
      { goalId: 'goal-1' },
    )
    await settle()
    expect(hook.result.current.tasks.map(t => t.name)).toEqual([
      'FIRST-GOAL-TASK',
    ])

    hook.renders.length = 0
    fakeSupabase.setRows('workspace_tasks', [])
    hook.rerender({ goalId: 'goal-2' })
    await settle()

    for (const render of hook.renders) {
      expect(render.tasks.map(t => t.name)).not.toContain('FIRST-GOAL-TASK')
    }
  })
})
