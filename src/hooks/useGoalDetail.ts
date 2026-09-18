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
import {
  blockingTasksFor,
  isTaskReady,
  tasksById as buildTasksById,
} from '@/lib/goals/dependencies'
import type { AuthUser } from '@/hooks/useAuth'
import {
  TaskDependency,
  WorkspaceMember,
  WorkspaceTask,
} from '@/types/workspace'

type TaskDependencyRow = {
  id: string
  workspace_id: string
  goal_id: string
  blocking_task_id: string
  blocked_task_id: string
  created_by: string
  created_at: string
}

function rowToDependency(row: TaskDependencyRow): TaskDependency {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    goalId: row.goal_id,
    blockingTaskId: row.blocking_task_id,
    blockedTaskId: row.blocked_task_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }
}

// A single Goal's tasks + subtasks (Task -> Subtask is the only hierarchy
// level a Goal allows). Mirrors useWorkspaceTasks.ts's realtime pattern,
// scoped by goal_id instead of "flat tasks in this workspace", and shares
// its mutation logic via useWorkspaceTaskActions so both views stay in sync.
export function useGoalDetail(
  goalId: string,
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
  const [dependencies, setDependencies] = useState<TaskDependency[]>([])
  const [dependenciesReady, setDependenciesReady] = useState(false)
  const now = useTimer()
  const onCompleteRef = useRef(onComplete)
  const completingRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    if (!userId || !goalId) {
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
        .eq('goal_id', goalId)
        .order('position', { ascending: true })
        .then(({ data, error: fetchError }) => {
          if (cancelled) return
          if (fetchError) {
            setError("Couldn't load this goal's tasks.")
            setReady(true)
            return
          }
          setTasks(((data ?? []) as WorkspaceTaskRow[]).map(rowToTask))
          setReady(true)
        })
    }

    fetchTasks(true)

    const handleReconnect = () => fetchTasks(false)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') handleReconnect()
    }
    window.addEventListener('online', handleReconnect)
    document.addEventListener('visibilitychange', handleVisibility)

    const channel = supabase
      .channel(`goal-tasks-${goalId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workspace_tasks',
          filter: `goal_id=eq.${goalId}`,
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
  }, [userId, goalId])

  useEffect(() => {
    if (!userId || !goalId) {
      setDependencies([])
      setDependenciesReady(true)
      return
    }
    let cancelled = false
    const supabase = createClient()

    const fetchDependencies = () => {
      supabase
        .from('task_dependencies')
        .select('*')
        .eq('goal_id', goalId)
        .then(({ data, error: fetchError }) => {
          if (cancelled) return
          if (fetchError) {
            setError("Couldn't load task dependencies.")
            setDependenciesReady(true)
            return
          }
          setDependencies(
            ((data ?? []) as TaskDependencyRow[]).map(rowToDependency),
          )
          setDependenciesReady(true)
        })
    }

    fetchDependencies()

    const handleReconnect = () => fetchDependencies()
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') handleReconnect()
    }
    window.addEventListener('online', handleReconnect)
    document.addEventListener('visibilitychange', handleVisibility)

    const channel = supabase
      .channel(`goal-dependencies-${goalId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_dependencies',
          filter: `goal_id=eq.${goalId}`,
        },
        payload => {
          if (cancelled) return
          if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id?: string }).id
            if (deletedId)
              setDependencies(current =>
                current.filter(d => d.id !== deletedId),
              )
            return
          }
          const incoming = rowToDependency(payload.new as TaskDependencyRow)
          setDependencies(current => {
            const exists = current.some(d => d.id === incoming.id)
            return exists
              ? current.map(d => (d.id === incoming.id ? incoming : d))
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
  }, [userId, goalId])

  const addDependency = (blockingTaskId: string, blockedTaskId: string) => {
    const supabase = createClient()
    void supabase
      .rpc('add_task_dependency', {
        p_blocking_task_id: blockingTaskId,
        p_blocked_task_id: blockedTaskId,
      })
      .then(({ error: rpcError }) => {
        if (rpcError)
          setError(rpcError.message || "Couldn't add the dependency.")
      })
  }

  const removeDependency = (dependencyId: string) => {
    const supabase = createClient()
    void supabase
      .rpc('remove_task_dependency', { p_dependency_id: dependencyId })
      .then(({ error: rpcError }) => {
        if (rpcError) setError("Couldn't remove the dependency.")
      })
  }

  const {
    addTask: addTaskAction,
    updateTask,
    startTask,
    pauseTask,
    emergencyStopTask,
    finishTask,
    deleteTask,
    moveTask,
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

  const addTask = (
    event: Parameters<typeof addTaskAction>[0],
    form: Parameters<typeof addTaskAction>[1],
    parentTaskId: string | null = null,
    assignedTo: string | null = null,
  ) => addTaskAction(event, form, parentTaskId, assignedTo, goalId)

  // Same auto-complete-on-planned-time behavior as flat tasks (useWorkspaceTasks.ts) —
  // goal tasks use the identical execution model.
  useEffect(() => {
    if (!userId) return
    // Only the timer's own controller completes it — see useWorkspaceTasks.ts.
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

  const tasksMap = buildTasksById(tasks)

  return {
    tasks,
    ready,
    error,
    addTask,
    updateTask,
    startTask,
    pauseTask,
    emergencyStopTask,
    finishTask,
    deleteTask,
    moveTask,
    reassignTask,
    getLiveSeconds: (task: WorkspaceTask) => getWorkspaceLiveSeconds(task, now),
    dependencies,
    dependenciesReady,
    addDependency,
    removeDependency,
    isTaskReady: (taskId: string) =>
      isTaskReady(taskId, dependencies, tasksMap),
    blockingTasksFor: (taskId: string) =>
      blockingTasksFor(taskId, dependencies, tasksMap),
  }
}
