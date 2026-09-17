import { FormEvent, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getLiveSeconds, useTimer } from '@/hooks/useTimer'
import { notifyTaskCompletion } from '@/lib/notifications'
import { Settings, Task, TaskFormValues } from '@/types'
import type { AuthUser } from '@/hooks/useAuth'
import { PersonalTaskRow, rowToTask, taskPatchToRow } from '@/lib/tasks/mappers'

// Supabase-backed mirror of useTasks.ts's exact contract, so Dashboard can
// swap between them without any UI component knowing which one is active.
// Every timer-affecting action (start/pause/complete) goes through a single
// Postgres RPC that atomically closes any open time entry, rolls its
// duration into actual_seconds, and opens/closes the new one — see
// supabase/migrations/0001_phase2_personal_tasks.sql.
export function useCloudTasks(
  user: AuthUser | null,
  settings: Settings,
  onComplete?: (task: Task) => void,
) {
  const userId = user?.id
  const [tasks, setTasks] = useState<Task[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const now = useTimer()
  const onCompleteRef = useRef(onComplete)
  const positionsRef = useRef<Map<string, number>>(new Map())
  const completingRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    if (!userId) {
      setTasks([])
      positionsRef.current = new Map()
      setReady(true)
      return
    }

    let cancelled = false
    setReady(false)
    const supabase = createClient()
    supabase
      .from('personal_tasks')
      .select('*')
      .eq('user_id', userId)
      .order('position', { ascending: true })
      .then(({ data, error: fetchError }) => {
        if (cancelled) return
        if (fetchError) {
          setError("Couldn't load your tasks.")
          setReady(true)
          return
        }
        const rows = (data ?? []) as PersonalTaskRow[]
        positionsRef.current = new Map(rows.map(row => [row.id, row.position]))
        setTasks(rows.map(rowToTask))
        setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  const updateTask = (id: string, update: Partial<Task>) => {
    if (!userId) return
    setTasks(current =>
      current.map(task => (task.id === id ? { ...task, ...update } : task)),
    )
    const patch = taskPatchToRow(update)
    if (Object.keys(patch).length === 0) return
    const supabase = createClient()
    void supabase
      .from('personal_tasks')
      .update(patch)
      .eq('id', id)
      .then(({ error: updateError }) => {
        if (updateError) setError("Couldn't save your changes.")
      })
  }

  const startTask = (id: string) => {
    if (!userId) return
    setTasks(current =>
      current.map(task => {
        if (task.id === id)
          return { ...task, status: 'active', startedAt: Date.now() }
        if (task.status === 'active')
          return {
            ...task,
            status: 'paused',
            workedSeconds: Math.round(getLiveSeconds(task, now)),
            startedAt: null,
          }
        return task
      }),
    )
    const supabase = createClient()
    void supabase
      .rpc('start_personal_task', { p_task_id: id })
      .then(({ error: rpcError }) => {
        if (rpcError) setError("Couldn't start the timer.")
      })
  }

  const pauseTask = (task: Task) => {
    if (!userId) return
    const workedSeconds = Math.round(getLiveSeconds(task, now))
    setTasks(current =>
      current.map(t =>
        t.id === task.id
          ? { ...t, status: 'paused', workedSeconds, startedAt: null }
          : t,
      ),
    )
    const supabase = createClient()
    void supabase
      .rpc('pause_personal_task', { p_task_id: task.id })
      .then(({ error: rpcError }) => {
        if (rpcError) setError("Couldn't pause the timer.")
      })
  }

  const finishTask = (task: Task, early = false) => {
    if (!userId) return
    notifyTaskCompletion(task.name)
    onCompleteRef.current?.(task)
    const workedSeconds = Math.round(getLiveSeconds(task, now))
    setTasks(current =>
      current.map(t =>
        t.id === task.id
          ? {
              ...t,
              status: early ? 'skipped' : 'completed',
              workedSeconds,
              startedAt: null,
            }
          : t,
      ),
    )
    const supabase = createClient()
    void supabase
      .rpc('complete_personal_task', { p_task_id: task.id, p_skip: early })
      .then(({ error: rpcError }) => {
        if (rpcError) setError("Couldn't save task completion.")
      })
  }

  const addTask = (event: FormEvent, form: TaskFormValues) => {
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
        name,
        plannedMinutes,
        workedSeconds: 0,
        status: 'pending',
        startedAt: null,
        goalName,
        goalProgress,
      },
    ])

    const supabase = createClient()
    void supabase
      .from('personal_tasks')
      .insert({
        id,
        user_id: userId,
        title: name,
        planned_seconds: plannedMinutes * 60,
        goal_name: goalName ?? null,
        goal_percentage: goalProgress ?? null,
      })
      .select('position')
      .single()
      .then(({ data, error: insertError }) => {
        if (insertError || !data) {
          setError("Couldn't add the task.")
          setTasks(current => current.filter(task => task.id !== id))
          return
        }
        positionsRef.current.set(id, (data as { position: number }).position)
      })

    return true
  }

  const deleteTask = (id: string) => {
    if (!userId) return
    const removed = tasks.find(task => task.id === id)
    setTasks(current => current.filter(task => task.id !== id))
    positionsRef.current.delete(id)
    const supabase = createClient()
    void supabase
      .from('personal_tasks')
      .delete()
      .eq('id', id)
      .then(({ error: deleteError }) => {
        if (deleteError) {
          setError("Couldn't remove the task.")
          if (removed) setTasks(current => [...current, removed])
        }
      })
  }

  const restartTask = (task: Task) => {
    if (!userId) return
    const id = crypto.randomUUID()
    setTasks(current => [
      ...current,
      { ...task, id, workedSeconds: 0, status: 'pending', startedAt: null },
    ])
    const supabase = createClient()
    void supabase
      .from('personal_tasks')
      .insert({
        id,
        user_id: userId,
        title: task.name,
        planned_seconds: task.plannedMinutes * 60,
        goal_name: task.goalName ?? null,
        goal_percentage: task.goalProgress ?? null,
      })
      .select('position')
      .single()
      .then(({ data, error: insertError }) => {
        if (insertError || !data) {
          setError("Couldn't restart the task.")
          setTasks(current => current.filter(t => t.id !== id))
          return
        }
        positionsRef.current.set(id, (data as { position: number }).position)
      })
  }

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

    const supabase = createClient()
    const prevPos = reordered[toIndex - 1]
      ? positionsRef.current.get(reordered[toIndex - 1].id)
      : undefined
    const nextPos = reordered[toIndex + 1]
      ? positionsRef.current.get(reordered[toIndex + 1].id)
      : undefined

    const midpoint = (() => {
      if (prevPos === undefined && nextPos === undefined) return 1000
      if (prevPos === undefined) return nextPos! - 1000
      if (nextPos === undefined) return prevPos + 1000
      const mid = Math.floor((prevPos + nextPos) / 2)
      return mid > prevPos && mid < nextPos ? mid : null
    })()

    if (midpoint !== null) {
      positionsRef.current.set(movedTask.id, midpoint)
      void supabase
        .from('personal_tasks')
        .update({ position: midpoint })
        .eq('id', movedTask.id)
        .then(({ error: updateError }) => {
          if (updateError) setError("Couldn't save the new order.")
        })
      return
    }

    // Gap exhausted (neighbors one apart, no integer midpoint) — respace the
    // whole list in one statement. `reordered` already reflects the desired
    // final order, so this single call both fixes the gap and applies the move.
    const orderedIds = reordered.map(task => task.id)
    void supabase
      .rpc('renormalize_positions', { p_task_ids: orderedIds })
      .then(({ error: rpcError }) => {
        if (rpcError) {
          setError("Couldn't save the new order.")
          return
        }
        orderedIds.forEach((taskId, index) => {
          positionsRef.current.set(taskId, (index + 1) * 1000)
        })
      })
  }

  useEffect(() => {
    if (!userId) return
    const active = tasks.find(task => task.status === 'active')
    if (!active || getLiveSeconds(active, now) < active.plannedMinutes * 60)
      return
    if (completingRef.current.has(active.id)) return
    completingRef.current.add(active.id)

    notifyTaskCompletion(active.name)
    onCompleteRef.current?.(active)
    const finalSeconds = Math.round(getLiveSeconds(active, now))
    setTasks(current =>
      current.map(task =>
        task.id === active.id
          ? {
              ...task,
              status: 'completed',
              workedSeconds: finalSeconds,
              startedAt: null,
            }
          : task,
      ),
    )

    const supabase = createClient()
    void supabase
      .rpc('complete_personal_task', { p_task_id: active.id, p_skip: false })
      .then(({ error: rpcError }) => {
        completingRef.current.delete(active.id)
        if (rpcError) {
          setError("Couldn't save task completion.")
          return
        }
        if (!settings.autoStartNextTask) return
        const next = tasks.find(
          task => task.status === 'pending' || task.status === 'paused',
        )
        if (!next) return
        setTasks(current =>
          current.map(task =>
            task.id === next.id
              ? { ...task, status: 'active', startedAt: Date.now() }
              : task,
          ),
        )
        void supabase
          .rpc('start_personal_task', { p_task_id: next.id })
          .then(({ error: startError }) => {
            if (startError) setError("Couldn't start the next task.")
          })
      })
  }, [now, settings.autoStartNextTask, tasks, userId])

  const activeTask = tasks.find(task => task.status === 'active')
  const totalSeconds = Math.round(
    tasks.reduce((total, task) => total + getLiveSeconds(task, now), 0),
  )

  return {
    tasks,
    ready,
    now,
    activeTask,
    totalSeconds,
    updateTask,
    startTask,
    pauseTask,
    finishTask,
    addTask,
    deleteTask,
    restartTask,
    reorderTasks,
    getLiveSeconds: (task: Task) => getLiveSeconds(task, now),
    error,
  }
}
