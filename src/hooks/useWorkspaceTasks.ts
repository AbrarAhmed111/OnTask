import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTimer } from '@/hooks/useTimer'
import { notifyTaskCompletion } from '@/lib/notifications'
import { useWorkspaceTaskActions } from '@/hooks/useWorkspaceTaskActions'
import { canControlTimer } from '@/lib/tasks/timerPermissions'
import {
  WorkspaceTaskRow,
  getWorkspaceLiveSeconds,
  rowToTask,
} from '@/lib/tasks/workspaceMappers'
import type { AuthUser } from '@/hooks/useAuth'
import { WorkspaceMember, WorkspaceTask } from '@/types/workspace'

export { getWorkspaceLiveSeconds }

// Ordinary (non-Goal) workspace tasks — permanently flat: hierarchy and
// dependencies only exist inside Goals (useGoalDetail.ts). Realtime via
// Supabase, following the same pattern as useWorkspaceActivity.ts etc.
export function useWorkspaceTasks(
  workspaceId: string,
  user: AuthUser | null,
  members: WorkspaceMember[],
  onComplete?: (task: WorkspaceTask) => void,
  isPersonal = false,
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
        // Ordinary workspace tasks only — goal-scoped tasks/subtasks are
        // fetched separately by useGoalDetail, since hierarchy only exists
        // inside Goals now.
        .is('goal_id', null)
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
          const incomingRow = payload.new as WorkspaceTaskRow
          // A goal-scoped task belongs to useGoalDetail's realtime feed, not
          // this flat one — the filter above can't express "goal_id is
          // null" server-side, so it's enforced here instead.
          if (incomingRow.goal_id) {
            setTasks(current => current.filter(t => t.id !== incomingRow.id))
            return
          }
          const incoming = rowToTask(incomingRow)
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

  const {
    addTask: addTaskAction,
    updateTask,
    startTask,
    pauseTask,
    emergencyStopTask,
    finishTask,
    deleteTask,
    reassignTask,
  } = useWorkspaceTaskActions({
    workspaceId,
    userId,
    members,
    tasks,
    setTasks,
    setError,
    onComplete: task => onCompleteRef.current?.(task),
    now,
    isPersonal,
  })

  // Flat tasks never have a parent or a goal — the two params other callers
  // of the shared action accept (goal task creation) are fixed at null here.
  const addTask = (
    event: Parameters<typeof addTaskAction>[0],
    form: Parameters<typeof addTaskAction>[1],
    _parentTaskId: string | null = null,
    assignedTo: string | null = null,
  ) => addTaskAction(event, form, null, assignedTo, null)

  const reorderTasks = (fromIndex: number, toIndex: number) => {
    if (!userId) return
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= tasks.length ||
      toIndex >= tasks.length
    )
      return

    const reordered = [...tasks]
    const [movedTask] = reordered.splice(fromIndex, 1)
    reordered.splice(toIndex, 0, movedTask)
    setTasks(reordered)

    // Simple, workspace-scoped renormalization on every reorder — task
    // lists here are small team lists, so this is cheap.
    const supabase = createClient()
    void Promise.all(
      reordered.map((task, index) =>
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
    // Only the timer's own controller completes it — every member's browser
    // sees the same running task, and the server rejects anyone else.
    const working = tasks.find(
      task =>
        task.status === 'working' &&
        canControlTimer(task, { userId, isPersonal }),
    )
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
  }, [now, tasks, userId, isPersonal])

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
    emergencyStopTask,
    finishTask,
    deleteTask,
    reassignTask,
    reorderTasks,
    getLiveSeconds: (task: WorkspaceTask) => getWorkspaceLiveSeconds(task, now),
  }
}
