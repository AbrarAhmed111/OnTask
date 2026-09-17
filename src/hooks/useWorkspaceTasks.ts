import { FormEvent, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTimer } from '@/hooks/useTimer'
import { notifyTaskCompletion } from '@/lib/notifications'
import type { AuthUser } from '@/hooks/useAuth'
import {
  WorkspaceMember,
  WorkspaceTask,
  WorkspaceTaskStatus,
} from '@/types/workspace'
import { TaskFormValues } from '@/types'

type WorkspaceTaskRow = {
  id: string
  workspace_id: string
  parent_task_id: string | null
  created_by: string
  assigned_to: string | null
  title: string
  planned_seconds: number
  actual_seconds: number
  status: WorkspaceTaskStatus
  goal_name: string | null
  goal_percentage: number | null
  started_at: string | null
  completed_at: string | null
}

function rowToTask(row: WorkspaceTaskRow): WorkspaceTask {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    parentTaskId: row.parent_task_id,
    createdBy: row.created_by,
    assignedTo: row.assigned_to,
    name: row.title,
    plannedMinutes: Math.round(row.planned_seconds / 60),
    workedSeconds: row.actual_seconds,
    status: row.status,
    goalName: row.goal_name ?? undefined,
    goalProgress: row.goal_percentage ?? undefined,
    startedAt: row.started_at ? new Date(row.started_at).getTime() : null,
    completedAt: row.completed_at ? new Date(row.completed_at).getTime() : null,
  }
}

// Same live-elapsed-time pattern as useTimer's getLiveSeconds, just against
// WorkspaceTaskStatus's 'working' instead of personal Task's 'active'.
export function getWorkspaceLiveSeconds(task: WorkspaceTask, now: number) {
  return (
    task.workedSeconds +
    (task.status === 'working' && task.startedAt
      ? Math.max(0, now - task.startedAt) / 1000
      : 0)
  )
}

function memberDisplayName(member?: WorkspaceMember) {
  return member?.fullName || member?.email || 'Someone'
}

// Not realtime yet — that's Phase 8. This hook fetches once per workspace
// and reflects only this browser's own actions; other members' changes
// appear on next reload until Phase 8 adds a live subscription.
export function useWorkspaceTasks(
  workspaceId: string,
  user: AuthUser | null,
  members: WorkspaceMember[],
  onComplete?: (task: WorkspaceTask) => void,
) {
  const userId = user?.id
  const [tasks, setTasks] = useState<WorkspaceTask[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const now = useTimer()
  const onCompleteRef = useRef(onComplete)
  const completingRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    if (!userId || !workspaceId) {
      setTasks([])
      setReady(true)
      return
    }
    let cancelled = false
    const supabase = createClient()

    const fetchTasks = (showLoading: boolean) => {
      if (showLoading) setReady(false)
      supabase
        .from('workspace_tasks')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('position', { ascending: true })
        .then(({ data, error: fetchError }) => {
          if (cancelled) return
          if (fetchError) {
            setError("Couldn't load workspace tasks.")
            setReady(true)
            return
          }
          setTasks(((data ?? []) as WorkspaceTaskRow[]).map(rowToTask))
          setReady(true)
        })
    }

    fetchTasks(true)

    // Timer state is never trusted from memory alone across a reconnect —
    // a dropped websocket (laptop sleep, network blip) can silently miss
    // postgres_changes events, so coming back online or back into the tab
    // always re-derives the full task list from the database.
    const handleReconnect = () => fetchTasks(false)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') handleReconnect()
    }
    window.addEventListener('online', handleReconnect)
    document.addEventListener('visibilitychange', handleVisibility)

    const channel = supabase
      .channel(`workspace-tasks-${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workspace_tasks',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        payload => {
          if (cancelled) return
          if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id?: string }).id
            if (deletedId)
              setTasks(current => current.filter(t => t.id !== deletedId))
            return
          }
          const incoming = rowToTask(payload.new as WorkspaceTaskRow)
          setTasks(current => {
            const exists = current.some(t => t.id === incoming.id)
            return exists
              ? current.map(t => (t.id === incoming.id ? incoming : t))
              : [...current, incoming]
          })
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      window.removeEventListener('online', handleReconnect)
      document.removeEventListener('visibilitychange', handleVisibility)
      supabase.removeChannel(channel)
    }
  }, [userId, workspaceId])

  const logEvent = (
    taskId: string,
    eventType: string,
    metadata: Record<string, unknown>,
  ) => {
    if (!userId) return
    const supabase = createClient()
    void supabase.from('task_events').insert({
      task_id: taskId,
      workspace_id: workspaceId,
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
  ) => {
    event.preventDefault()
    if (!userId) return false
    const plannedMinutes =
      Number(form.hours || 0) * 60 + Number(form.minutes || 0)
    if (!form.name.trim() || plannedMinutes <= 0) return false

    const id = crypto.randomUUID()
    const name = form.name.trim()
    const goalName = form.trackGoal ? form.goal.trim() || undefined : undefined
    const goalProgress = form.trackGoal
      ? Math.min(100, Math.max(0, Number(form.progress) || 0))
      : undefined

    setTasks(current => [
      ...current,
      {
        id,
        workspaceId,
        parentTaskId,
        createdBy: userId,
        assignedTo,
        name,
        plannedMinutes,
        workedSeconds: 0,
        status: 'queued',
        startedAt: null,
        completedAt: null,
        goalName,
        goalProgress,
      },
    ])

    const supabase = createClient()
    void supabase
      .from('workspace_tasks')
      .insert({
        id,
        workspace_id: workspaceId,
        parent_task_id: parentTaskId,
        created_by: userId,
        assigned_to: assignedTo,
        title: name,
        planned_seconds: plannedMinutes * 60,
        goal_name: goalName ?? null,
        goal_percentage: goalProgress ?? null,
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
    setTasks(current =>
      current.map(task => (task.id === id ? { ...task, ...update } : task)),
    )
    const row: Record<string, unknown> = {}
    if (update.name !== undefined) row.title = update.name
    if (update.plannedMinutes !== undefined)
      row.planned_seconds = update.plannedMinutes * 60
    if (update.goalName !== undefined) row.goal_name = update.goalName ?? null
    if (update.goalProgress !== undefined)
      row.goal_percentage = update.goalProgress ?? null
    if (Object.keys(row).length === 0) return
    const supabase = createClient()
    void supabase
      .from('workspace_tasks')
      .update(row)
      .eq('id', id)
      .then(({ error: updateError }) => {
        if (updateError) setError("Couldn't save your changes.")
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
    onCompleteRef.current?.(task)
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
          logEvent(id, 'deleted', {
            title: removed.name,
            parent_title: parentTitle,
          })
        }
      })
  }

  const moveTask = (id: string, parentTaskId: string | null) => {
    if (!userId || id === parentTaskId) return
    const hasChildren = tasks.some(task => task.parentTaskId === id)
    if (hasChildren && parentTaskId !== null) return
    if (parentTaskId !== null) {
      const target = tasks.find(task => task.id === parentTaskId)
      if (!target || target.parentTaskId !== null) return
    }
    updateTask(id, { parentTaskId })
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
        const task = tasks.find(t => t.id === id)
        logEvent(id, 'parent_changed', {
          title: task?.name,
          to: parentTaskId
            ? tasks.find(t => t.id === parentTaskId)?.name
            : 'Standalone',
          parent_title: parentTaskId
            ? tasks.find(t => t.id === parentTaskId)?.name
            : undefined,
        })
      })
  }

  const reassignTask = (id: string, newAssigneeId: string | null) => {
    if (!userId) return
    const task = tasks.find(t => t.id === id)
    const fromName = memberDisplayName(
      members.find(m => m.userId === task?.assignedTo),
    )
    const toName = newAssigneeId
      ? memberDisplayName(members.find(m => m.userId === newAssigneeId))
      : 'Unassigned'
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
        logEvent(id, task?.assignedTo ? 'reassigned' : 'assigned', {
          title: task?.name,
          from: fromName,
          to: toName,
          parent_title: parentTitle,
        })
      })
  }

  const reorderTasks = (fromIndex: number, toIndex: number) => {
    if (!userId) return
    const rootIndices = tasks.reduce<number[]>((acc, task, index) => {
      if (!task.parentTaskId) acc.push(index)
      return acc
    }, [])
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= rootIndices.length ||
      toIndex >= rootIndices.length
    )
      return

    const roots = rootIndices.map(index => tasks[index])
    const reorderedRoots = [...roots]
    const [movedTask] = reorderedRoots.splice(fromIndex, 1)
    reorderedRoots.splice(toIndex, 0, movedTask)

    const next = [...tasks]
    rootIndices.forEach((slot, i) => {
      next[slot] = reorderedRoots[i]
    })
    setTasks(next)

    // Simple, workspace-scoped renormalization on every root reorder — task
    // lists here are small team lists, so this is cheap; see Phase 2's
    // personal-task hook for the midpoint-based version used where a finer
    // approach was worth the extra code.
    const supabase = createClient()
    void Promise.all(
      reorderedRoots.map((task, index) =>
        supabase
          .from('workspace_tasks')
          .update({ position: (index + 1) * 1000 })
          .eq('id', task.id),
      ),
    ).then(results => {
      if (results.some(r => r.error)) setError("Couldn't save the new order.")
    })
  }

  useEffect(() => {
    if (!userId) return
    const working = tasks.find(task => task.status === 'working')
    if (
      !working ||
      getWorkspaceLiveSeconds(working, now) < working.plannedMinutes * 60
    )
      return
    if (completingRef.current.has(working.id)) return
    completingRef.current.add(working.id)

    notifyTaskCompletion(working.name)
    onCompleteRef.current?.(working)
    const finalSeconds = Math.round(getWorkspaceLiveSeconds(working, now))
    setTasks(current =>
      current.map(task =>
        task.id === working.id
          ? {
              ...task,
              status: 'completed',
              workedSeconds: finalSeconds,
              startedAt: null,
              completedAt: Date.now(),
            }
          : task,
      ),
    )
    const supabase = createClient()
    void supabase
      .rpc('complete_workspace_task', { p_task_id: working.id, p_skip: false })
      .then(({ error: rpcError }) => {
        completingRef.current.delete(working.id)
        if (rpcError) setError("Couldn't save task completion.")
      })
  }, [now, tasks, userId])

  const activeTask = tasks.find(task => task.status === 'working')

  return {
    tasks,
    ready,
    error,
    activeTask,
    addTask,
    updateTask,
    startTask,
    pauseTask,
    finishTask,
    deleteTask,
    moveTask,
    reassignTask,
    reorderTasks,
    getLiveSeconds: (task: WorkspaceTask) => getWorkspaceLiveSeconds(task, now),
  }
}
