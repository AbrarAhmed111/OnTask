import { FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { notifyTaskCompletion } from '@/lib/notifications'
import { WorkspaceMember, WorkspaceTask } from '@/types/workspace'
import { TaskFormValues } from '@/types'
import { getWorkspaceLiveSeconds } from '@/lib/tasks/workspaceMappers'

function memberDisplayName(member?: WorkspaceMember) {
  return member?.fullName || member?.email || 'Someone'
}

// Shared task-mutation logic for both the flat workspace task list
// (useWorkspaceTasks.ts) and a single Goal's task/subtask list
// (useGoalDetail.ts) — the two views differ only in which tasks they hold
// and whether new tasks are created with a goalId, so the actual RPC calls,
// optimistic updates, and event logging live here once.
export function useWorkspaceTaskActions({
  workspaceId,
  userId,
  members,
  tasks,
  setTasks,
  setError,
  onComplete,
  now,
}: {
  workspaceId: string
  userId: string | undefined
  members: WorkspaceMember[]
  tasks: WorkspaceTask[]
  setTasks: (updater: (current: WorkspaceTask[]) => WorkspaceTask[]) => void
  setError: (error: string | null) => void
  onComplete?: (task: WorkspaceTask) => void
  now: number
}) {
  const logEvent = (
    taskId: string,
    eventType: string,
    metadata: Record<string, unknown>,
    goalId?: string | null,
  ) => {
    if (!userId) return
    const supabase = createClient()
    void supabase.from('task_events').insert({
      task_id: taskId,
      workspace_id: workspaceId,
      goal_id: goalId ?? null,
      actor_id: userId,
      event_type: eventType,
      metadata,
    })
  }

  const addTask = (
    event: FormEvent,
    form: TaskFormValues,
    parentTaskId: string | null = null,
    assignedTo: string | null = null,
    goalId: string | null = null,
  ) => {
    event.preventDefault()
    if (!userId) return false
    const plannedMinutes =
      Number(form.hours || 0) * 60 + Number(form.minutes || 0)
    if (!form.name.trim() || plannedMinutes <= 0) return false

    const id = crypto.randomUUID()
    const name = form.name.trim()
    const progressLabel = form.trackGoal
      ? form.goal.trim() || undefined
      : undefined
    const progressPercentage = form.trackGoal
      ? Math.min(100, Math.max(0, Number(form.progress) || 0))
      : undefined

    setTasks(current => [
      ...current,
      {
        id,
        workspaceId,
        parentTaskId,
        goalId,
        createdBy: userId,
        assignedTo,
        name,
        plannedMinutes,
        workedSeconds: 0,
        status: 'queued',
        startedAt: null,
        completedAt: null,
        progressLabel,
        progressPercentage,
      },
    ])

    const supabase = createClient()
    void supabase
      .from('workspace_tasks')
      .insert({
        id,
        workspace_id: workspaceId,
        parent_task_id: parentTaskId,
        goal_id: goalId,
        created_by: userId,
        assigned_to: assignedTo,
        title: name,
        planned_seconds: plannedMinutes * 60,
        progress_label: progressLabel ?? null,
        progress_percentage: progressPercentage ?? null,
      })
      .then(({ error: insertError }) => {
        if (insertError) {
          setError("Couldn't add the task.")
          setTasks(current => current.filter(task => task.id !== id))
        }
      })

    return true
  }

  const updateTask = (id: string, update: Partial<WorkspaceTask>) => {
    if (!userId) return
    const before = tasks.find(task => task.id === id)
    setTasks(current =>
      current.map(task => (task.id === id ? { ...task, ...update } : task)),
    )
    const row: Record<string, unknown> = {}
    if (update.name !== undefined) row.title = update.name
    if (update.plannedMinutes !== undefined)
      row.planned_seconds = update.plannedMinutes * 60
    if (update.progressLabel !== undefined)
      row.progress_label = update.progressLabel ?? null
    if (update.progressPercentage !== undefined)
      row.progress_percentage = update.progressPercentage ?? null
    if (Object.keys(row).length === 0) return
    const supabase = createClient()
    void supabase
      .from('workspace_tasks')
      .update(row)
      .eq('id', id)
      .then(({ error: updateError }) => {
        if (updateError) {
          setError("Couldn't save your changes.")
          return
        }
        const parentTitle = before?.parentTaskId
          ? tasks.find(t => t.id === before.parentTaskId)?.name
          : undefined
        // Progress is logged separately from a plain edit — the aggregator
        // reconstructs progress_start/progress_end for the AI summary from
        // this event's from/to, never from the task's current value, so a
        // later edit can't rewrite what progress looked like that day.
        if (
          update.progressPercentage !== undefined &&
          update.progressPercentage !== before?.progressPercentage
        ) {
          logEvent(
            id,
            'progress_changed',
            {
              title: update.name ?? before?.name,
              parent_title: parentTitle,
              from: before?.progressPercentage ?? null,
              to: update.progressPercentage ?? null,
            },
            before?.goalId,
          )
        }
        if (update.name !== undefined || update.plannedMinutes !== undefined) {
          logEvent(
            id,
            'edited',
            {
              title: update.name ?? before?.name,
              parent_title: parentTitle,
            },
            before?.goalId,
          )
        }
      })
  }

  const startTask = (id: string) => {
    if (!userId) return
    const isParent = tasks.some(task => task.parentTaskId === id)
    if (isParent) return
    setTasks(current =>
      current.map(task => {
        if (task.id === id)
          return { ...task, status: 'working', startedAt: Date.now() }
        if (task.status === 'working')
          return {
            ...task,
            status: 'paused',
            workedSeconds: Math.round(getWorkspaceLiveSeconds(task, now)),
            startedAt: null,
          }
        return task
      }),
    )
    const supabase = createClient()
    void supabase
      .rpc('start_workspace_task', { p_task_id: id })
      .then(({ error: rpcError }) => {
        if (rpcError) setError("Couldn't start the timer.")
      })
  }

  const pauseTask = (task: WorkspaceTask) => {
    if (!userId) return
    const workedSeconds = Math.round(getWorkspaceLiveSeconds(task, now))
    setTasks(current =>
      current.map(t =>
        t.id === task.id
          ? { ...t, status: 'paused', workedSeconds, startedAt: null }
          : t,
      ),
    )
    const supabase = createClient()
    void supabase
      .rpc('pause_workspace_task', { p_task_id: task.id })
      .then(({ error: rpcError }) => {
        if (rpcError) setError("Couldn't pause the timer.")
      })
  }

  const finishTask = (task: WorkspaceTask, early = false) => {
    if (!userId) return
    notifyTaskCompletion(task.name)
    onComplete?.(task)
    const workedSeconds = Math.round(getWorkspaceLiveSeconds(task, now))
    setTasks(current =>
      current.map(t =>
        t.id === task.id
          ? {
              ...t,
              status: early ? 'skipped' : 'completed',
              workedSeconds,
              startedAt: null,
              completedAt: Date.now(),
            }
          : t,
      ),
    )
    const supabase = createClient()
    void supabase
      .rpc('complete_workspace_task', { p_task_id: task.id, p_skip: early })
      .then(({ error: rpcError }) => {
        if (rpcError) setError("Couldn't save task completion.")
      })
  }

  const deleteTask = (id: string) => {
    if (!userId) return
    const removed = tasks.find(task => task.id === id)
    setTasks(current => current.filter(task => task.id !== id))
    const supabase = createClient()
    void supabase
      .from('workspace_tasks')
      .delete()
      .eq('id', id)
      .then(({ error: deleteError }) => {
        if (deleteError) {
          setError("Couldn't remove the task.")
          if (removed) setTasks(current => [...current, removed])
          return
        }
        if (removed) {
          const parentTitle = removed.parentTaskId
            ? tasks.find(t => t.id === removed.parentTaskId)?.name
            : undefined
          logEvent(
            id,
            'deleted',
            {
              title: removed.name,
              parent_title: parentTitle,
            },
            removed.goalId,
          )
        }
      })
  }

  // A task can only move under a root task that isn't itself a child (one
  // level of nesting), and a task with children of its own can't become
  // someone else's child. Passing null makes it a top-level goal task again.
  // The DB trigger (enforce_goal_task_hierarchy) also requires the target to
  // share the same goal — irrelevant here since both tasks always come from
  // the same goal-scoped list, but still enforced server-side as a backstop.
  const moveTask = (id: string, parentTaskId: string | null) => {
    if (!userId || id === parentTaskId) return
    const hasChildren = tasks.some(task => task.parentTaskId === id)
    if (hasChildren && parentTaskId !== null) return
    if (parentTaskId !== null) {
      const target = tasks.find(task => task.id === parentTaskId)
      if (!target || target.parentTaskId !== null) return
    }
    const task = tasks.find(t => t.id === id)
    setTasks(current =>
      current.map(t => (t.id === id ? { ...t, parentTaskId } : t)),
    )
    const supabase = createClient()
    void supabase
      .from('workspace_tasks')
      .update({ parent_task_id: parentTaskId })
      .eq('id', id)
      .then(({ error: updateError }) => {
        if (updateError) {
          setError("Couldn't move the task.")
          return
        }
        logEvent(
          id,
          'parent_changed',
          {
            title: task?.name,
            to: parentTaskId
              ? tasks.find(t => t.id === parentTaskId)?.name
              : 'Standalone',
            parent_title: parentTaskId
              ? tasks.find(t => t.id === parentTaskId)?.name
              : undefined,
          },
          task?.goalId,
        )
      })
  }

  const reassignTask = (id: string, newAssigneeId: string | null) => {
    if (!userId) return
    const task = tasks.find(t => t.id === id)
    const fromMember = members.find(m => m.userId === task?.assignedTo)
    const toMember = newAssigneeId
      ? members.find(m => m.userId === newAssigneeId)
      : undefined
    const fromName = memberDisplayName(fromMember)
    const toName = newAssigneeId ? memberDisplayName(toMember) : 'Unassigned'
    setTasks(current =>
      current.map(t => (t.id === id ? { ...t, assignedTo: newAssigneeId } : t)),
    )
    const supabase = createClient()
    void supabase
      .from('workspace_tasks')
      .update({ assigned_to: newAssigneeId })
      .eq('id', id)
      .then(({ error: updateError }) => {
        if (updateError) {
          setError("Couldn't reassign the task.")
          return
        }
        const parentTitle = task?.parentTaskId
          ? tasks.find(t => t.id === task.parentTaskId)?.name
          : undefined
        const eventType = !newAssigneeId
          ? 'unassigned'
          : task?.assignedTo
            ? 'reassigned'
            : 'assigned'
        // to_user_id/from_user_id (not just display-name strings) are what
        // notify_from_task_event() needs to know who to notify.
        logEvent(
          id,
          eventType,
          {
            title: task?.name,
            from: fromName,
            to: toName,
            from_user_id: task?.assignedTo ?? null,
            to_user_id: newAssigneeId,
            parent_title: parentTitle,
          },
          task?.goalId,
        )
      })
  }

  return {
    logEvent,
    addTask,
    updateTask,
    startTask,
    pauseTask,
    finishTask,
    deleteTask,
    moveTask,
    reassignTask,
  }
}
