import { describe, expect, it, vi } from 'vitest'
import {
  AutoCompletionEffects,
  GuardedCompletion,
  isMissingFunctionError,
  parseGuardedCompletion,
  RETRY_AFTER_FAILURE_MS,
  RETRY_AFTER_UNCONFIRMED_MS,
  createCompletionTracker,
  findDueTask,
  isTaskDue,
  runAutoCompletion,
  timerRunId,
} from '@/lib/tasks/autoCompletion'
import {
  authoritativeView,
  initialSnapshot,
  snapshotReducer,
} from '@/lib/snapshots/snapshotState'
import type { WorkspaceTask } from '@/types/workspace'
import type { WorkspaceTaskRow } from '@/lib/tasks/workspaceMappers'

const ME = 'user-me'
const actor = { userId: ME, isPersonal: false }
const START = Date.parse('2026-09-19T10:00:00Z')

// A running task started at START with 60 planned minutes, assigned to me.
function task(overrides: Partial<WorkspaceTask> = {}): WorkspaceTask {
  return {
    id: 't-1',
    workspaceId: 'ws-1',
    parentTaskId: null,
    goalId: null,
    createdBy: ME,
    assignedTo: ME,
    name: 'Write report',
    plannedMinutes: 60,
    workedSeconds: 0,
    status: 'working',
    startedAt: START,
    completedAt: null,
    ...overrides,
  }
}

const PLANNED_END = START + 60 * 60 * 1000

// The only way to obtain authoritative data is through a server-confirmed
// snapshot -- exactly what the app does.
function authoritative(tasks: WorkspaceTask[]) {
  const key = 'k'
  let state = snapshotReducer(initialSnapshot<WorkspaceTask[]>(null, []), {
    type: 'reset',
    key,
    initial: [],
  })
  state = snapshotReducer(state, { type: 'confirm', key, data: tasks })
  return authoritativeView(state)!
}

describe('isTaskDue', () => {
  it('is due exactly when the planned time has run out', () => {
    expect(isTaskDue(task(), actor, PLANNED_END - 1000)).toBe(false)
    expect(isTaskDue(task(), actor, PLANNED_END)).toBe(true)
    expect(isTaskDue(task(), actor, PLANNED_END + 60_000)).toBe(true)
  })

  it('counts time already worked before this run', () => {
    const resumed = task({ workedSeconds: 50 * 60 })

    expect(isTaskDue(resumed, actor, START + 9 * 60 * 1000)).toBe(false)
    expect(isTaskDue(resumed, actor, START + 10 * 60 * 1000)).toBe(true)
  })

  it.each(['queued', 'paused', 'blocked', 'completed', 'skipped'] as const)(
    'is never due while %s',
    status => {
      expect(isTaskDue(task({ status }), actor, PLANNED_END + 1e6)).toBe(false)
    },
  )

  it("is not due for someone else's timer", () => {
    const theirs = task({ assignedTo: 'user-other' })

    expect(isTaskDue(theirs, actor, PLANNED_END + 1e6)).toBe(false)
  })

  it('an unassigned task is due when planned time has run out', () => {
    const unassigned = task({ assignedTo: null })

    expect(isTaskDue(unassigned, actor, PLANNED_END)).toBe(true)
    expect(
      isTaskDue(unassigned, { ...actor, isPersonal: true }, PLANNED_END),
    ).toBe(true)
  })

  it('is never due when plannedMinutes is null', () => {
    const noPlanned = task({ plannedMinutes: null })

    expect(isTaskDue(noPlanned, actor, PLANNED_END + 1e9)).toBe(false)
  })
})

describe('findDueTask', () => {
  it('finds the running, overdue task the user controls', () => {
    const due = findDueTask(
      authoritative([task({ id: 'a', status: 'queued' }), task({ id: 'b' })]),
      actor,
      PLANNED_END,
    )

    expect(due?.task.id).toBe('b')
    expect(due?.run).toBe(timerRunId(task({ id: 'b' })))
  })

  it('finds nothing when nothing is due', () => {
    expect(findDueTask(authoritative([task()]), actor, START + 1000)).toBeNull()
  })
})

describe('timerRunId', () => {
  it('differs for a second start of the same task', () => {
    expect(timerRunId(task({ startedAt: START }))).not.toBe(
      timerRunId(task({ startedAt: START + 5000 })),
    )
  })
})

describe('createCompletionTracker', () => {
  it('lets a run be claimed once', () => {
    const tracker = createCompletionTracker()

    expect(tracker.claim('r', 0)).toBe(true)
    expect(tracker.claim('r', 1)).toBe(false)
  })

  it('never lets a completed run be claimed again', () => {
    const tracker = createCompletionTracker()
    tracker.claim('r', 0)
    tracker.succeeded('r')

    expect(tracker.claim('r', 1e9)).toBe(false)
  })

  it('lets a failed run be retried, but only after its delay', () => {
    const tracker = createCompletionTracker()
    tracker.claim('r', 0)
    tracker.retryAfter('r', 100, 1000)

    expect(tracker.claim('r', 500)).toBe(false)
    expect(tracker.claim('r', 1100)).toBe(true)
  })

  it('treats another run of the same task as a separate claim', () => {
    const tracker = createCompletionTracker()
    tracker.claim('t-1@100', 0)
    tracker.succeeded('t-1@100')

    expect(tracker.claim('t-1@200', 0)).toBe(true)
  })

  it('announces a run only once', () => {
    const tracker = createCompletionTracker()

    expect(tracker.announce('r')).toBe(true)
    expect(tracker.announce('r')).toBe(false)
  })
})

// A scripted stand-in for the server and the UI, recording what happened.
function setup(
  server: {
    current?: WorkspaceTask | null
    readFails?: boolean
    completeOk?: boolean
  } = {},
) {
  const log: string[] = []
  let clockNow = PLANNED_END + 1000
  const tracker = createCompletionTracker()
  const state = {
    current: server.current === undefined ? task() : server.current,
    readFails: server.readFails ?? false,
    completeOk: server.completeOk ?? true,
  }
  const effects: AutoCompletionEffects = {
    actor,
    tracker,
    clock: () => clockNow,
    readCurrent: vi.fn(async () => {
      log.push('read')
      if (state.readFails) throw new Error('offline')
      return state.current
    }),
    reconcile: vi.fn(() => void log.push('reconcile')),
    announce: vi.fn(() => void log.push('announce')),
    showCompleted: vi.fn(() => void log.push('showCompleted')),
    revert: vi.fn(() => void log.push('revert')),
    complete: vi.fn(async () => {
      log.push('complete')
      return state.completeOk
    }),
    onFailure: vi.fn(() => void log.push('onFailure')),
  }
  const due = () => findDueTask(authoritative([task()]), actor, clockNow)!
  return {
    log,
    effects,
    state,
    tracker,
    due,
    advance: (ms: number) => {
      clockNow += ms
    },
  }
}

describe('runAutoCompletion', () => {
  it('confirms with the server first, then alerts, shows it done and completes it -- in that order', async () => {
    const { log, effects, due } = setup()

    const outcome = await runAutoCompletion(due(), effects)

    expect(outcome).toBe('completed')
    expect(log).toEqual([
      'read',
      'reconcile',
      'announce',
      'showCompleted',
      'complete',
    ])
  })

  it('does nothing when the server says the task was paused elsewhere', async () => {
    const { log, effects, due } = setup({
      current: task({ status: 'paused', startedAt: null }),
    })

    const outcome = await runAutoCompletion(due(), effects)

    expect(outcome).toBe('not-due')
    expect(effects.complete).not.toHaveBeenCalled()
    expect(effects.announce).not.toHaveBeenCalled()
    expect(effects.showCompleted).not.toHaveBeenCalled()
    // ...and the list is corrected from what the server said.
    expect(log).toEqual(['read', 'reconcile'])
  })

  it('does nothing when the server says the task was restarted (a different run)', async () => {
    const { effects, due } = setup({
      current: task({ startedAt: PLANNED_END + 500 }),
    })

    expect(await runAutoCompletion(due(), effects)).toBe('not-due')
    expect(effects.complete).not.toHaveBeenCalled()
  })

  it('does nothing when the server says its time was extended', async () => {
    const { effects, due } = setup({ current: task({ plannedMinutes: 120 }) })

    expect(await runAutoCompletion(due(), effects)).toBe('not-due')
    expect(effects.complete).not.toHaveBeenCalled()
  })

  it('does nothing when the task no longer exists', async () => {
    const { effects, due } = setup({ current: null })

    expect(await runAutoCompletion(due(), effects)).toBe('not-due')
    expect(effects.complete).not.toHaveBeenCalled()
  })

  it('does nothing when it cannot reach the server -- it will not act on what it cannot confirm', async () => {
    const { effects, due } = setup({ readFails: true })

    const outcome = await runAutoCompletion(due(), effects)

    expect(outcome).toBe('unconfirmed')
    expect(effects.complete).not.toHaveBeenCalled()
    expect(effects.announce).not.toHaveBeenCalled()
  })

  it('tries again once the server is reachable', async () => {
    const { effects, due, state, advance } = setup({ readFails: true })
    await runAutoCompletion(due(), effects)

    state.readFails = false
    advance(RETRY_AFTER_UNCONFIRMED_MS + 1)
    const outcome = await runAutoCompletion(due(), effects)

    expect(outcome).toBe('completed')
    expect(effects.complete).toHaveBeenCalledTimes(1)
  })

  it('completes a run once, however many times it is evaluated (refetch, realtime, re-render)', async () => {
    const { effects, due } = setup()

    const first = await runAutoCompletion(due(), effects)
    // A background refetch that raced the commit shows the same run still
    // working, and the next timer tick evaluates it again.
    const second = await runAutoCompletion(due(), effects)
    const third = await runAutoCompletion(due(), effects)

    expect([first, second, third]).toEqual(['completed', 'skipped', 'skipped'])
    expect(effects.complete).toHaveBeenCalledTimes(1)
  })

  it('does not start a second attempt while the first is still in flight', async () => {
    const { effects, due } = setup()

    const [a, b] = await Promise.all([
      runAutoCompletion(due(), effects),
      runAutoCompletion(due(), effects),
    ])

    expect([a, b].sort()).toEqual(['completed', 'skipped'])
    expect(effects.complete).toHaveBeenCalledTimes(1)
  })

  it('a failed completion is reverted, reported, and retried later -- without alerting twice', async () => {
    const { effects, due, state, advance, log } = setup({ completeOk: false })

    expect(await runAutoCompletion(due(), effects)).toBe('failed')
    expect(log).toContain('revert')
    expect(effects.onFailure).toHaveBeenCalledTimes(1)

    // Not retried on the very next tick...
    expect(await runAutoCompletion(due(), effects)).toBe('skipped')

    // ...but once the delay has passed, and the server accepts it.
    state.completeOk = true
    advance(RETRY_AFTER_FAILURE_MS + 1)
    expect(await runAutoCompletion(due(), effects)).toBe('completed')
    expect(effects.announce).toHaveBeenCalledTimes(1)
  })

  it('treats a completion that throws as a failure, not a stuck claim', async () => {
    const { effects, due, advance } = setup()
    vi.mocked(effects.complete).mockRejectedValueOnce(new Error('boom'))

    expect(await runAutoCompletion(due(), effects)).toBe('failed')

    advance(RETRY_AFTER_FAILURE_MS + 1)
    expect(await runAutoCompletion(due(), effects)).toBe('completed')
  })

  it('a new run of the same task (paused and resumed) can be completed again', async () => {
    const { effects, tracker } = setup()
    const firstRun = findDueTask(
      authoritative([task({ startedAt: START })]),
      actor,
      PLANNED_END + 1000,
    )!
    await runAutoCompletion(firstRun, effects)
    expect(tracker.claim(firstRun.run, 0)).toBe(false)

    const resumedAt = PLANNED_END + 2000
    const secondTask = task({ startedAt: resumedAt, plannedMinutes: 1 })
    const secondRun = findDueTask(
      authoritative([secondTask]),
      actor,
      resumedAt + 61_000,
    )!
    effects.readCurrent = async () => secondTask
    const outcome = await runAutoCompletion(secondRun, {
      ...effects,
      clock: () => resumedAt + 61_000,
    })

    expect(outcome).toBe('completed')
  })
})

// ── the database completes it (migration 0043) ───────────────────────────────
describe('runAutoCompletion: guarded by the database', () => {
  // The completed row the database hands back.
  const completedTask = () =>
    task({
      status: 'completed',
      startedAt: null,
      completedAt: PLANNED_END + 1000,
    })

  function setupGuarded(reply: () => Promise<GuardedCompletion>) {
    const base = setup()
    const completeGuarded = vi.fn(async (t: WorkspaceTask) => {
      base.log.push(`guarded:${t.id}`)
      return reply()
    })
    base.effects.completeGuarded = completeGuarded
    return { ...base, completeGuarded }
  }

  it('asks the database once, with the task it saw, and takes the row it returns', async () => {
    const { log, effects, due, completeGuarded } = setupGuarded(async () => ({
      kind: 'completed',
      task: completedTask(),
    }))
    const candidate = due()

    const outcome = await runAutoCompletion(candidate, effects)

    expect(outcome).toBe('completed')
    expect(completeGuarded).toHaveBeenCalledWith(candidate.task)
    // No separate read, no optimistic guess, no unguarded RPC: the database
    // both checked and did it. It alerts only now that it is done.
    expect(log).toEqual(['guarded:t-1', 'announce', 'reconcile'])
    expect(effects.readCurrent).not.toHaveBeenCalled()
    expect(effects.complete).not.toHaveBeenCalled()
    expect(effects.showCompleted).not.toHaveBeenCalled()
    expect(effects.reconcile).toHaveBeenCalledWith('t-1', completedTask())
  })

  it('when the database declines, nothing is announced or completed, and the list takes the row it returned', async () => {
    const paused = task({ status: 'paused', startedAt: null })
    const { effects, due } = setupGuarded(async () => ({
      kind: 'declined',
      task: paused,
    }))

    const outcome = await runAutoCompletion(due(), effects)

    expect(outcome).toBe('not-due')
    expect(effects.announce).not.toHaveBeenCalled()
    expect(effects.complete).not.toHaveBeenCalled()
    expect(effects.reconcile).toHaveBeenCalledWith('t-1', paused)
  })

  it('a task the database no longer finds is removed from the list', async () => {
    const { effects, due } = setupGuarded(async () => ({
      kind: 'declined',
      task: null,
    }))

    await runAutoCompletion(due(), effects)

    expect(effects.reconcile).toHaveBeenCalledWith('t-1', null)
  })

  it('a declined run is asked again later, not on the next tick (its clock may be behind ours)', async () => {
    let answer: GuardedCompletion = { kind: 'declined', task: task() }
    const { effects, due, completeGuarded, advance } = setupGuarded(
      async () => answer,
    )

    expect(await runAutoCompletion(due(), effects)).toBe('not-due')
    expect(await runAutoCompletion(due(), effects)).toBe('skipped')
    expect(completeGuarded).toHaveBeenCalledTimes(1)

    answer = { kind: 'completed', task: completedTask() }
    advance(RETRY_AFTER_UNCONFIRMED_MS + 1)
    expect(await runAutoCompletion(due(), effects)).toBe('completed')
    expect(completeGuarded).toHaveBeenCalledTimes(2)
  })

  it('a failed request is reported and retried later -- with nothing shown or alerted meanwhile', async () => {
    let fails = true
    const { effects, due, advance } = setupGuarded(async () => {
      if (fails) throw new Error('offline')
      return { kind: 'completed', task: completedTask() }
    })

    expect(await runAutoCompletion(due(), effects)).toBe('failed')
    expect(effects.onFailure).toHaveBeenCalledTimes(1)
    expect(effects.announce).not.toHaveBeenCalled()
    expect(effects.reconcile).not.toHaveBeenCalled()
    expect(effects.revert).not.toHaveBeenCalled() // nothing was shown to undo

    fails = false
    expect(await runAutoCompletion(due(), effects)).toBe('skipped')
    advance(RETRY_AFTER_FAILURE_MS + 1)
    expect(await runAutoCompletion(due(), effects)).toBe('completed')
    expect(effects.announce).toHaveBeenCalledTimes(1)
  })

  it('completes a run once, however many times it is evaluated afterwards', async () => {
    const { effects, due, completeGuarded } = setupGuarded(async () => ({
      kind: 'completed',
      task: completedTask(),
    }))

    const outcomes = [
      await runAutoCompletion(due(), effects),
      await runAutoCompletion(due(), effects),
      await runAutoCompletion(due(), effects),
    ]

    expect(outcomes).toEqual(['completed', 'skipped', 'skipped'])
    expect(completeGuarded).toHaveBeenCalledTimes(1)
  })

  it('does not ask twice while the first request is still in flight', async () => {
    const { effects, due, completeGuarded } = setupGuarded(async () => ({
      kind: 'completed',
      task: completedTask(),
    }))

    const [a, b] = await Promise.all([
      runAutoCompletion(due(), effects),
      runAutoCompletion(due(), effects),
    ])

    expect([a, b].sort()).toEqual(['completed', 'skipped'])
    expect(completeGuarded).toHaveBeenCalledTimes(1)
  })

  it('a database without the function ("unsupported") falls back to reading, then completing', async () => {
    const { log, effects, due, completeGuarded } = setupGuarded(async () => ({
      kind: 'unsupported',
    }))

    const outcome = await runAutoCompletion(due(), effects)

    expect(outcome).toBe('completed')
    expect(completeGuarded).toHaveBeenCalledTimes(1)
    expect(log).toEqual([
      'guarded:t-1',
      'read',
      'reconcile',
      'announce',
      'showCompleted',
      'complete',
    ])
  })

  it('the fallback keeps every earlier guarantee (a paused task is still not completed)', async () => {
    const base = setup({ current: task({ status: 'paused', startedAt: null }) })
    base.effects.completeGuarded = async () => ({ kind: 'unsupported' })

    expect(await runAutoCompletion(base.due(), base.effects)).toBe('not-due')
    expect(base.effects.complete).not.toHaveBeenCalled()
  })
})

describe('parseGuardedCompletion', () => {
  const row = (
    overrides: Partial<WorkspaceTaskRow> = {},
  ): WorkspaceTaskRow => ({
    id: 't-1',
    workspace_id: 'ws-1',
    parent_task_id: null,
    goal_id: null,
    created_by: ME,
    assigned_to: ME,
    title: 'Write report',
    planned_seconds: 3600,
    actual_seconds: 7200,
    status: 'completed',
    progress_label: null,
    progress_percentage: null,
    started_at: null,
    completed_at: '2026-09-19T12:00:01.500000+00:00',
    ...overrides,
  })

  it('reads a completed reply into the task the app uses', () => {
    const result = parseGuardedCompletion({ outcome: 'completed', task: row() })

    expect(result.kind).toBe('completed')
    if (result.kind !== 'completed') return
    expect(result.task).toMatchObject({
      id: 't-1',
      name: 'Write report',
      status: 'completed',
      workedSeconds: 7200,
      plannedMinutes: 60,
      startedAt: null,
    })
    expect(result.task.completedAt).toBe(Date.parse('2026-09-19T12:00:01.500Z'))
  })

  it.each(['not_running', 'different_run', 'not_due'])(
    'reads a %s reply as declined, with the current task',
    outcome => {
      const result = parseGuardedCompletion({
        outcome,
        task: row({
          status: 'working',
          started_at: '2026-09-19T10:00:00+00:00',
        }),
      })

      expect(result.kind).toBe('declined')
      if (result.kind !== 'declined') return
      expect(result.task?.status).toBe('working')
    },
  )

  it('reads not_found as declined with no task', () => {
    expect(
      parseGuardedCompletion({ outcome: 'not_found', task: null }),
    ).toEqual({
      kind: 'declined',
      task: null,
    })
  })

  it.each([
    ['nothing', undefined],
    ['null', null],
    ['a string', 'completed'],
    ['no outcome', { task: row() }],
    ['a non-string outcome', { outcome: 5, task: row() }],
    ['completed without the task', { outcome: 'completed', task: null }],
  ])('rejects a reply that is %s, rather than guessing', (_name, reply) => {
    expect(() => parseGuardedCompletion(reply)).toThrow()
  })
})

describe('isMissingFunctionError', () => {
  it.each([
    [{ code: 'PGRST202', message: 'Could not find the function' }, true],
    [{ code: '42883', message: 'function does not exist' }, true],
    [{ code: '42501', message: 'permission denied' }, false],
    [{ code: 'PGRST116' }, false],
    [{ message: 'Failed to fetch' }, false],
    [null, false],
    ['PGRST202', false],
  ])('%j -> %s', (error, expected) => {
    expect(isMissingFunctionError(error)).toBe(expected)
  })
})
