import { FormEvent, useEffect, useRef, useState } from 'react'
import { loadTasks, saveTasks } from '@/lib/storage'
import { getLiveSeconds, useTimer } from '@/hooks/useTimer'
import { notifyTaskCompletion } from '@/lib/notifications'
import { Settings, Task, TaskFormValues } from '@/types'

export function useTasks(
  settings: Settings,
  onComplete?: (task: Task) => void,
) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [ready, setReady] = useState(false)
  const now = useTimer()
  const onCompleteRef = useRef(onComplete)

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    setTasks(loadTasks())
    setReady(true)
  }, [])

  useEffect(() => {
    if (ready) saveTasks(tasks)
  }, [ready, tasks])

  useEffect(() => {
    const active = tasks.find(task => task.status === 'active')
    if (!active || getLiveSeconds(active, now) < active.plannedMinutes * 60)
      return

    notifyTaskCompletion(active.name)
    onCompleteRef.current?.(active)
    setTasks(current => {
      const completed = current.map(task =>
        task.id === active.id
          ? {
              ...task,
              status: 'completed' as const,
              workedSeconds: Math.round(getLiveSeconds(task, now)),
              startedAt: null,
            }
          : task,
      )
      if (!settings.autoStartNextTask) return completed

      const next = completed.find(
        task => task.status === 'pending' || task.status === 'paused',
      )
      return next
        ? completed.map(task =>
            task.id === next.id
              ? { ...task, status: 'active' as const, startedAt: Date.now() }
              : task,
          )
        : completed
    })
  }, [now, settings.autoStartNextTask, tasks])

  const updateTask = (id: string, update: Partial<Task>) => {
    setTasks(current =>
      current.map(task => (task.id === id ? { ...task, ...update } : task)),
    )
  }

  const startTask = (id: string) => {
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
  }

  const pauseTask = (task: Task) =>
    updateTask(task.id, {
      status: 'paused',
      workedSeconds: Math.round(getLiveSeconds(task, now)),
      startedAt: null,
    })

  const finishTask = (task: Task, early = false) => {
    notifyTaskCompletion(task.name)
    onCompleteRef.current?.(task)
    updateTask(task.id, {
      status: early ? 'skipped' : 'completed',
      workedSeconds: Math.round(getLiveSeconds(task, now)),
      startedAt: null,
    })
  }

  const addTask = (event: FormEvent, form: TaskFormValues) => {
    event.preventDefault()
    const plannedMinutes =
      Number(form.hours || 0) * 60 + Number(form.minutes || 0)
    if (!form.name.trim() || plannedMinutes <= 0) return false
    setTasks(current => [
      ...current,
      {
        id: crypto.randomUUID(),
        name: form.name.trim(),
        plannedMinutes,
        workedSeconds: 0,
        status: 'pending',
        startedAt: null,
        goalName: form.trackGoal ? form.goal.trim() || undefined : undefined,
        goalProgress: form.trackGoal
          ? Math.min(100, Math.max(0, Number(form.progress) || 0))
          : undefined,
      },
    ])
    return true
  }

  const deleteTask = (id: string) =>
    setTasks(current => current.filter(task => task.id !== id))

  const restartTask = (task: Task) =>
    setTasks(current => [
      ...current,
      {
        ...task,
        id: crypto.randomUUID(),
        workedSeconds: 0,
        status: 'pending',
        startedAt: null,
      },
    ])

  const reorderTasks = (fromIndex: number, toIndex: number) => {
    setTasks(current => {
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= current.length ||
        toIndex >= current.length
      )
        return current

      const reordered = [...current]
      const [movedTask] = reordered.splice(fromIndex, 1)
      reordered.splice(toIndex, 0, movedTask)
      return reordered
    })
  }

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
  }
}
