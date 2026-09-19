import type { Authoritative } from '@/lib/snapshots/snapshotState'
import { canControlTimer } from '@/lib/tasks/timerPermissions'
import {
  WorkspaceTaskRow,
  getWorkspaceLiveSeconds,
  rowToTask,
} from '@/lib/tasks/workspaceMappers'
import type { WorkspaceTask } from '@/types/workspace'

// Completing a task when its planned time runs out.
//
// The `complete_workspace_task` RPC (what a manual Finish uses) does not check
// that the task is still running, or that its time is up: it completes whatever
// it is pointed at and logs another `completed` event every time it is called.
// So the decision to call it has to be right, and made once -- and the database
// gets the last word (`auto_complete_workspace_task`, migration 0043). That is
// split into three stages, each taking only what it is allowed to act on:
//
//   EVALUATE  findDueTask()      needs an Authoritative<WorkspaceTask[]> -- data
//                                the server has confirmed this session. Cached
//                                data cannot be passed in (see snapshotState.ts).
//   CLAIM     tracker.claim()    one attempt per timer RUN, for the whole
//                                session: a refetch, a realtime event or a
//                                remount that shows the same run again cannot
//                                start a second completion.
//   EXECUTE   runAutoCompletion  asks the DATABASE to complete it. Holding the
//                                task's row lock, on its own clock, it checks
//                                the task is still working, is still the run we
//                                saw, and is really out of time -- and otherwise
//                                changes nothing and hands back the task as it is.
//                                (A database that predates 0043 has no such
//                                function; then the task is re-read from Supabase
//                                right before acting and completed with the
//                                unguarded RPC, as before.)
//
// Pure functions and injected effects, so all of it is tested without React or
// a database; hooks/useTaskAutoCompletion.ts is the thin wiring.

export type CompletionActor = { userId: string; isPersonal: boolean }

// One start of a task's timer. `startedAt` is set by the server on every start
// and cleared on pause/finish, so pausing and resuming -- or extending a
// completed task and starting it again -- is a different run of the same task.
export function timerRunId(task: Pick<WorkspaceTask, 'id' | 'startedAt'>) {
  return `${task.id}@${task.startedAt ?? 'not-started'}`
}

// Only the timer's own controller completes it (every member's browser sees the
// same running task, and the server rejects anyone else).
export function isTaskDue(
  task: WorkspaceTask,
  actor: CompletionActor,
  now: number,
): boolean {
  if (
    task.plannedMinutes === null ||
    task.plannedMinutes === undefined ||
    task.plannedMinutes <= 0
  ) {
    return false
  }
  return (
    task.status === 'working' &&
    canControlTimer(task, actor) &&
    getWorkspaceLiveSeconds(task, now) >= task.plannedMinutes * 60
  )
}

declare const dueBrand: unique symbol

// A task found due in authoritative data. The only way to get one is
// findDueTask, and runAutoCompletion only accepts one, so there is no route to
// completing a task that skips the evaluation.
export type DueTask = {
  readonly task: WorkspaceTask
  readonly run: string
  readonly [dueBrand]: true
}

export function findDueTask(
  tasks: Authoritative<WorkspaceTask[]>,
  actor: CompletionActor,
  now: number,
): DueTask | null {
  const task = tasks.data.find(candidate => isTaskDue(candidate, actor, now))
  return task ? ({ task, run: timerRunId(task) } as DueTask) : null
}

// After a failed attempt the same run is tried again, but not on the next tick
// (the timer effect fires every second).
export const RETRY_AFTER_FAILURE_MS = 15_000
// Reading the task failed, or the server said it isn't due yet (clock skew).
export const RETRY_AFTER_UNCONFIRMED_MS = 5_000

type RunState =
  { phase: 'inflight' } | { phase: 'done' } | { phase: 'retry'; at: number }

export type CompletionTracker = ReturnType<typeof createCompletionTracker>

export function createCompletionTracker() {
  const runs = new Map<string, RunState>()
  const announced = new Set<string>()

  return {
    // True if the caller may attempt this run now. A run in flight or already
    // completed is refused for good; a failed one only once its retry time has
    // passed.
    claim(run: string, now: number): boolean {
      const state = runs.get(run)
      if (state && !(state.phase === 'retry' && now >= state.at)) return false
      runs.set(run, { phase: 'inflight' })
      return true
    },
    succeeded(run: string) {
      runs.set(run, { phase: 'done' })
    },
    retryAfter(run: string, now: number, delayMs: number) {
      runs.set(run, { phase: 'retry', at: now + delayMs })
    },
    // The "task finished" alert (sound, notification, dialog) happens once per
    // run, however many times completing it has to be retried.
    announce(run: string): boolean {
      if (announced.has(run)) return false
      announced.add(run)
      return true
    },
  }
}

// One tracker for the whole browser session, not one per hook instance: a
// remount (navigating away and back mid-request) must not forget what has
// already been sent. Run ids embed the task id, so users cannot collide.
export const sessionCompletionTracker = createCompletionTracker()

// What auto_complete_workspace_task said (migration 0043).
export type GuardedCompletion =
  // It was due and the database completed it; `task` is the completed row.
  | { kind: 'completed'; task: WorkspaceTask }
  // It did not (paused, restarted, extended, already completed, not yet due on
  // the database's clock); `task` is the row as it is now, or null if it is gone
  // or not visible.
  | { kind: 'declined'; task: WorkspaceTask | null }
  // The database predates the function: use the read-then-complete path.
  | { kind: 'unsupported' }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// PostgREST says PGRST202 for an RPC the schema doesn't have, Postgres 42883.
export function isMissingFunctionError(error: unknown): boolean {
  return (
    isRecord(error) && (error.code === 'PGRST202' || error.code === '42883')
  )
}

// The function's `{ outcome, task }` reply. Throws on anything else, which the
// caller treats like any other failed request.
export function parseGuardedCompletion(data: unknown): GuardedCompletion {
  if (!isRecord(data) || typeof data.outcome !== 'string') {
    throw new Error('Unexpected reply from auto_complete_workspace_task')
  }
  const task = isRecord(data.task)
    ? rowToTask(data.task as unknown as WorkspaceTaskRow)
    : null
  if (data.outcome === 'completed') {
    if (!task) throw new Error('auto_complete_workspace_task: no task returned')
    return { kind: 'completed', task }
  }
  return { kind: 'declined', task }
}

export type AutoCompletionOutcome =
  'skipped' | 'unconfirmed' | 'not-due' | 'completed' | 'failed'

export type AutoCompletionEffects = {
  actor: CompletionActor
  tracker: CompletionTracker
  clock: () => number
  // Asks the database to complete the run this task is in -- and only that run
  // (migration 0043). Rejects when the request fails. Left out, or answering
  // 'unsupported', the read-then-complete path below is used instead.
  completeGuarded?: (task: WorkspaceTask) => Promise<GuardedCompletion>
  // The task as Supabase has it right now (null: gone or not visible). Throws
  // when it cannot be read.
  readCurrent: (taskId: string) => Promise<WorkspaceTask | null>
  // Bring the list in line with what the server just said.
  reconcile: (taskId: string, current: WorkspaceTask | null) => void
  // The alarm, browser notification and completion dialog.
  announce: (task: WorkspaceTask) => void
  // The task shown as completed straight away, before the RPC answers.
  showCompleted: (task: WorkspaceTask, workedSeconds: number) => void
  // Undo showCompleted when the RPC failed.
  revert: (task: WorkspaceTask) => void
  // True if the server completed it.
  complete: (taskId: string) => Promise<boolean>
  onFailure: () => void
}

export async function runAutoCompletion(
  due: DueTask,
  fx: AutoCompletionEffects,
): Promise<AutoCompletionOutcome> {
  const { run } = due
  if (!fx.tracker.claim(run, fx.clock())) return 'skipped'

  if (fx.completeGuarded) {
    let guarded: GuardedCompletion
    try {
      guarded = await fx.completeGuarded(due.task)
    } catch {
      // Nothing was shown as completed, so there is nothing to undo.
      fx.onFailure()
      fx.tracker.retryAfter(run, fx.clock(), RETRY_AFTER_FAILURE_MS)
      return 'failed'
    }
    if (guarded.kind === 'completed') {
      // The database did it: only now is there anything to announce, and the
      // list takes the row it returned rather than a guess.
      if (fx.tracker.announce(run)) fx.announce(guarded.task)
      fx.reconcile(due.task.id, guarded.task)
      fx.tracker.succeeded(run)
      return 'completed'
    }
    if (guarded.kind === 'declined') {
      // It changed nothing, and told us what the task is now.
      fx.reconcile(due.task.id, guarded.task)
      fx.tracker.retryAfter(run, fx.clock(), RETRY_AFTER_UNCONFIRMED_MS)
      return 'not-due'
    }
    // 'unsupported': fall through to the path for databases without 0043.
  }

  // Confirm against the server, not the list: even server-confirmed data can
  // have missed a realtime event (a dropped socket) since it was read.
  let current: WorkspaceTask | null
  try {
    current = await fx.readCurrent(due.task.id)
  } catch {
    fx.tracker.retryAfter(run, fx.clock(), RETRY_AFTER_UNCONFIRMED_MS)
    return 'unconfirmed'
  }
  fx.reconcile(due.task.id, current)
  if (
    !current ||
    timerRunId(current) !== run ||
    !isTaskDue(current, fx.actor, fx.clock())
  ) {
    fx.tracker.retryAfter(run, fx.clock(), RETRY_AFTER_UNCONFIRMED_MS)
    return 'not-due'
  }

  if (fx.tracker.announce(run)) fx.announce(current)
  fx.showCompleted(
    current,
    Math.round(getWorkspaceLiveSeconds(current, fx.clock())),
  )
  // A throw is a failure like any other; either way the claim is settled, never
  // left "in flight" (which would block this run for good).
  let completed = false
  try {
    completed = await fx.complete(current.id)
  } catch {
    completed = false
  }
  if (completed) {
    fx.tracker.succeeded(run)
    return 'completed'
  }
  fx.revert(current)
  fx.onFailure()
  fx.tracker.retryAfter(run, fx.clock(), RETRY_AFTER_FAILURE_MS)
  return 'failed'
}
