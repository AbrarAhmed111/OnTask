import type {
  TaskBlocker,
  TaskBlockerStatus,
  WorkspaceTask,
} from '@/types/workspace'
import { getWorkspaceLiveSeconds } from '@/lib/tasks/workspaceMappers'

// The data half of task blockers (supabase/migrations/0041_task_blockers.sql):
// the row shapes, how realtime deliveries are folded into local state, and what
// a task looks like the instant it is blocked or unblocked. All pure, so the
// rules that are easy to get subtly wrong — duplicate and out-of-order events,
// optimistic rows meeting their server twins, the timer at the moment of
// blocking — can be tested without a database or a browser.

export type TaskBlockerRow = {
  id: string
  task_id: string
  workspace_id: string
  created_by: string
  reason: string
  status: TaskBlockerStatus
  created_at: string
  updated_at: string
  resolved_at: string | null
  resolved_by: string | null
  resolution_note: string | null
}

export type TaskBlockerMentionRow = {
  id: string
  blocker_id: string
  workspace_id: string
  mentioned_user_id: string
  added_by: string
  created_at: string
  removed_at: string | null
}

// A row the client made up before the server confirmed it. It always yields to
// the server's version of the same thing, whatever either clock says.
export type Optimistic<T> = T & { optimistic?: true }

export type BlockerRowState = Optimistic<TaskBlockerRow>
export type MentionRowState = Optimistic<TaskBlockerMentionRow>

// The database refuses longer text (task_blockers.reason / resolution_note);
// the fields stop at the same length so nobody types past what will be saved.
export const BLOCKER_REASON_MAX = 500
export const BLOCKER_NOTE_MAX = 500

// The members a blocker may actually name: each once, never the person raising
// it (the assignee can already resolve), and only people in the workspace right
// now. The server applies the same rules; running them here first means a stale
// picker can't send a mention that is certain to be refused.
export function sanitizeMentionedUserIds(
  requested: readonly string[],
  actorId: string,
  memberUserIds: readonly string[],
): string[] {
  return Array.from(new Set(requested)).filter(
    id => id !== actorId && memberUserIds.includes(id),
  )
}

const time = (iso: string) => Date.parse(iso)

// Fold one incoming blocker row (a realtime event, an RPC result, a refetch)
// into the local list. Keyed by id, so a redelivered event is a no-op and a
// client-minted id meets its own server row instead of duplicating it. A
// delivery that arrives late — an older `updated_at`, or "active" for a blocker
// already seen as resolved — never wins over newer state.
export function applyBlockerRow(
  rows: readonly BlockerRowState[],
  incoming: BlockerRowState,
): BlockerRowState[] {
  const current = rows.find(row => row.id === incoming.id)
  if (!current) return [...rows, incoming]
  if (!current.optimistic && !incoming.optimistic) {
    if (current.status === 'resolved' && incoming.status === 'active')
      return [...rows]
    if (time(incoming.updated_at) < time(current.updated_at)) return [...rows]
  }
  if (incoming.optimistic && !current.optimistic) return [...rows]
  return rows.map(row => (row.id === incoming.id ? incoming : row))
}

export function applyMentionRow(
  rows: readonly MentionRowState[],
  incoming: MentionRowState,
): MentionRowState[] {
  const current = rows.find(row => row.id === incoming.id)
  // The real row for a mention supersedes the placeholder made for it.
  const withoutPlaceholder = incoming.optimistic
    ? rows
    : rows.filter(
        row =>
          !(
            row.optimistic &&
            row.blocker_id === incoming.blocker_id &&
            row.mentioned_user_id === incoming.mentioned_user_id
          ),
      )
  if (!current) return [...withoutPlaceholder, incoming]
  if (!current.optimistic && !incoming.optimistic) {
    // A mention only ever goes from active to removed, never back.
    if (current.removed_at && !incoming.removed_at)
      return [...withoutPlaceholder]
  }
  if (incoming.optimistic && !current.optimistic) return [...withoutPlaceholder]
  return withoutPlaceholder.map(row =>
    row.id === incoming.id ? incoming : row,
  )
}

export function removeById<T extends { id: string }>(
  rows: readonly T[],
  id: string,
): T[] {
  return rows.filter(row => row.id !== id)
}

// A blocker's mentions live in their own table, so the two lists are joined
// here. Only ACTIVE blockers are returned, each with just the members it
// currently names (a removed mention is gone; the same person named twice, once
// as a placeholder and once for real, counts once).
export function activeBlockers(
  blockerRows: readonly BlockerRowState[],
  mentionRows: readonly MentionRowState[],
): TaskBlocker[] {
  return blockerRows
    .filter(row => row.status === 'active')
    .map(row => ({
      id: row.id,
      taskId: row.task_id,
      workspaceId: row.workspace_id,
      createdBy: row.created_by,
      reason: row.reason,
      status: row.status,
      createdAt: row.created_at,
      resolvedAt: row.resolved_at,
      resolvedBy: row.resolved_by,
      resolutionNote: row.resolution_note,
      mentionedUserIds: Array.from(
        new Set(
          mentionRows
            .filter(
              mention => mention.blocker_id === row.id && !mention.removed_at,
            )
            .map(mention => mention.mentioned_user_id),
        ),
      ),
    }))
}

export function blockerForTask(
  blockers: readonly TaskBlocker[],
  taskId: string,
): TaskBlocker | undefined {
  return blockers.find(blocker => blocker.taskId === taskId)
}

// What a task becomes the moment it is blocked. A running task's timer stops
// with the time so far kept — the same fold-in pause does — and from then on
// nothing accrues, because a blocked task has no startedAt: blocked time is
// never focused time. The database does this in the same write; this mirrors
// it so the card updates before the round trip.
export function blockedTaskState(
  task: WorkspaceTask,
  now: number,
): Pick<WorkspaceTask, 'status' | 'workedSeconds' | 'startedAt'> {
  return {
    status: 'blocked',
    workedSeconds: Math.round(getWorkspaceLiveSeconds(task, now)),
    startedAt: null,
  }
}

// Blocked -> Queued. Deliberately not 'working': the person who resolves a
// blocker isn't necessarily the assignee, and must never start their timer.
export function resolvedTaskState(): Pick<
  WorkspaceTask,
  'status' | 'startedAt'
> {
  return { status: 'queued', startedAt: null }
}

export function optimisticBlockerRows(args: {
  id: string
  task: Pick<WorkspaceTask, 'id' | 'workspaceId'>
  userId: string
  reason: string
  mentionedUserIds: readonly string[]
  now?: Date
}): { blocker: BlockerRowState; mentions: MentionRowState[] } {
  const stamp = (args.now ?? new Date()).toISOString()
  return {
    blocker: {
      id: args.id,
      task_id: args.task.id,
      workspace_id: args.task.workspaceId,
      created_by: args.userId,
      reason: args.reason,
      status: 'active',
      created_at: stamp,
      updated_at: stamp,
      resolved_at: null,
      resolved_by: null,
      resolution_note: null,
      optimistic: true,
    },
    mentions: args.mentionedUserIds.map(userId =>
      optimisticMentionRow({
        blockerId: args.id,
        workspaceId: args.task.workspaceId,
        userId,
        addedBy: args.userId,
        stamp,
      }),
    ),
  }
}

export function optimisticMentionRow(args: {
  blockerId: string
  workspaceId: string
  userId: string
  addedBy: string
  stamp?: string
}): MentionRowState {
  return {
    id: `optimistic:${args.blockerId}:${args.userId}`,
    blocker_id: args.blockerId,
    workspace_id: args.workspaceId,
    mentioned_user_id: args.userId,
    added_by: args.addedBy,
    created_at: args.stamp ?? new Date().toISOString(),
    removed_at: null,
    optimistic: true,
  }
}
