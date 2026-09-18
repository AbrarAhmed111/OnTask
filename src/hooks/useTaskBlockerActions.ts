import { createClient } from '@/lib/supabase/client'
import { useOptionalWorkspaceBlockers } from '@/components/workspaces/WorkspaceBlockersContext'
import {
  TaskBlockerRow,
  blockedTaskState,
  optimisticBlockerRows,
  resolvedTaskState,
  sanitizeMentionedUserIds,
} from '@/lib/tasks/blockers'
import {
  canBlockTask,
  canEditBlocker,
  canResolveBlocker,
} from '@/lib/tasks/blockerPermissions'
import type {
  TaskBlocker,
  WorkspaceMember,
  WorkspaceTask,
} from '@/types/workspace'

// What the blocker dialogs hand back: the reason as typed and the members it
// names. Ids only — a display name is never how anyone is identified.
export type BlockerInput = {
  reason: string
  mentionedUserIds: readonly string[]
}

// What a task card needs to act on a blocker. Supplied by whichever list owns
// the tasks (the flat queue, or one Goal), because blocking changes the task
// itself and only that list holds it — see TaskBlockerActionsContext.
export type TaskBlockerActions = {
  block: (task: WorkspaceTask, input: BlockerInput) => boolean
  update: (
    task: WorkspaceTask,
    blocker: TaskBlocker,
    input: BlockerInput,
  ) => boolean
  resolve: (task: WorkspaceTask, blocker: TaskBlocker, note: string) => boolean
}

// The RPCs refuse with 42501 (not allowed) or 55000 (the blocker/task is not in
// a state that allows it — usually someone got there first) and a message
// written to be read; anything else stays the generic fallback.
function blockerErrorMessage(
  error: { code?: string; message?: string },
  fallback: string,
) {
  return (error.code === '42501' || error.code === '55000') && error.message
    ? error.message.charAt(0).toUpperCase() + error.message.slice(1)
    : fallback
}

// Block / edit / resolve for the task lists' shared action hook
// (useWorkspaceTaskActions). Same pattern as its timer actions: change the
// local state at once, ask the server, and put back exactly what was touched if
// the server says no. The server is what decides — these checks only skip
// requests that are certain to be refused.
export function useTaskBlockerActions({
  workspaceId,
  userId,
  members,
  tasks,
  setTasks,
  setError,
  now,
  isPersonal,
  restoreTasks,
}: {
  workspaceId: string
  userId: string | undefined
  members: WorkspaceMember[]
  tasks: WorkspaceTask[]
  setTasks: (updater: (current: WorkspaceTask[]) => WorkspaceTask[]) => void
  setError: (error: string | null) => void
  now: number
  isPersonal: boolean
  restoreTasks: (snapshot: WorkspaceTask[]) => void
}): TaskBlockerActions {
  const blockers = useOptionalWorkspaceBlockers()
  const actor = { userId, isPersonal }
  const memberIds = members.map(member => member.userId)

  const block: TaskBlockerActions['block'] = (task, input) => {
    const store = blockers?.store
    if (!userId || !store) return false
    const reason = input.reason.trim()
    const hasSubtasks = tasks.some(t => t.parentTaskId === task.id)
    if (!reason || !canBlockTask(task, actor, hasSubtasks)) return false

    const mentioned = sanitizeMentionedUserIds(
      input.mentionedUserIds,
      userId,
      memberIds,
    )
    const blockerId = crypto.randomUUID()
    const rows = optimisticBlockerRows({
      id: blockerId,
      task: { id: task.id, workspaceId },
      userId,
      reason,
      mentionedUserIds: mentioned,
    })

    setTasks(current =>
      current.map(t =>
        t.id === task.id ? { ...t, ...blockedTaskState(t, now) } : t,
      ),
    )
    store.addOptimistic(rows.blocker, rows.mentions)

    const supabase = createClient()
    void supabase
      .rpc('block_workspace_task', {
        p_task_id: task.id,
        p_reason: reason,
        p_mentioned_user_ids: mentioned,
        p_blocker_id: blockerId,
      })
      .then(({ data, error: rpcError }) => {
        if (rpcError) {
          restoreTasks([task])
          store.removeBlocker(blockerId)
          setError(blockerErrorMessage(rpcError, "Couldn't block the task."))
          return
        }
        // The mentions arrive on their own (realtime) and replace their
        // placeholders; the blocker row is in hand, so take it now.
        if (data) store.applyBlocker(data as TaskBlockerRow)
      })
    return true
  }

  const update: TaskBlockerActions['update'] = (task, blocker, input) => {
    const store = blockers?.store
    if (!userId || !store || !canEditBlocker(task, blocker, actor)) return false
    const reason = input.reason.trim()
    if (!reason) return false

    const wanted = sanitizeMentionedUserIds(
      input.mentionedUserIds,
      userId,
      memberIds,
    )
    const added = wanted.filter(id => !blocker.mentionedUserIds.includes(id))
    const removed = blocker.mentionedUserIds.filter(id => !wanted.includes(id))
    const reasonChanged = reason !== blocker.reason
    // Nothing to send: no request, and so no event and no notification.
    if (!reasonChanged && added.length === 0 && removed.length === 0)
      return true

    const before = store.snapshot(blocker.id)
    if (reasonChanged) store.patchReason(blocker.id, reason)
    if (added.length > 0 || removed.length > 0)
      store.patchMentions(blocker.id, {
        add: added,
        remove: removed,
        workspaceId,
        by: userId,
      })

    const supabase = createClient()
    void supabase
      .rpc('update_task_blocker', {
        p_blocker_id: blocker.id,
        p_reason: reasonChanged ? reason : null,
        p_mentioned_user_ids:
          added.length > 0 || removed.length > 0 ? wanted : null,
      })
      .then(({ data, error: rpcError }) => {
        if (rpcError) {
          store.restoreBlocker(blocker.id, before.blocker, before.mentions)
          setError(blockerErrorMessage(rpcError, "Couldn't save the blocker."))
          return
        }
        if (data) store.applyBlocker(data as TaskBlockerRow)
      })
    return true
  }

  const resolve: TaskBlockerActions['resolve'] = (task, blocker, note) => {
    const store = blockers?.store
    if (
      !userId ||
      !store ||
      !canResolveBlocker(task, blocker, actor, memberIds)
    )
      return false

    const before = store.snapshot(blocker.id)
    // Blocked -> Queued, and nothing starts: whoever resolves may not be the
    // assignee.
    setTasks(current =>
      current.map(t =>
        t.id === task.id ? { ...t, ...resolvedTaskState() } : t,
      ),
    )
    store.markResolved(blocker.id, userId, note.trim() || null)

    const supabase = createClient()
    void supabase
      .rpc('resolve_task_blocker', {
        p_blocker_id: blocker.id,
        p_note: note.trim() || null,
      })
      .then(({ data, error: rpcError }) => {
        if (rpcError) {
          // 55000 here means someone resolved it first: the state we just
          // showed is the state the server is in, so keep it and just say so.
          if (rpcError.code !== '55000') {
            restoreTasks([task])
            store.restoreBlocker(blocker.id, before.blocker, before.mentions)
          }
          setError(
            blockerErrorMessage(rpcError, "Couldn't resolve the blocker."),
          )
          return
        }
        if (data) store.applyBlocker(data as TaskBlockerRow)
      })
    return true
  }

  return { block, update, resolve }
}
