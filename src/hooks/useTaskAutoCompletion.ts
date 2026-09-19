'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { notifyTaskCompletion } from '@/lib/notifications'
import type { Authoritative } from '@/lib/snapshots/snapshotState'
import {
  findDueTask,
  isMissingFunctionError,
  parseGuardedCompletion,
  runAutoCompletion,
  sessionCompletionTracker,
} from '@/lib/tasks/autoCompletion'
import { WorkspaceTaskRow, rowToTask } from '@/lib/tasks/workspaceMappers'
import type { WorkspaceTask } from '@/types/workspace'

// Completes a running task when its planned time runs out -- the wiring for
// lib/tasks/autoCompletion.ts, shared by the flat task list and a Goal's tasks
// (which used to carry two copies of this effect).
//
// `tasks` is deliberately an Authoritative<...>: data the server has confirmed
// this session. A list that came only from the local cache is not one (see
// snapshotState.ts), so it cannot be passed here and nothing is evaluated,
// alerted or completed from it -- the timer still ticks on screen, and the
// moment the server's answer arrives (or a realtime event confirms it) this
// runs against real data. Pass `null` until then.
export function useTaskAutoCompletion({
  tasks,
  userId,
  isPersonal,
  now,
  setTasks,
  setError,
  onComplete,
  belongsInList,
}: {
  tasks: Authoritative<WorkspaceTask[]> | null
  userId: string | undefined
  isPersonal: boolean
  // The current time (ticks every second): the effect re-evaluates on each tick.
  now: number
  setTasks: (updater: (current: WorkspaceTask[]) => WorkspaceTask[]) => void
  setError: (error: string | null) => void
  onComplete?: (task: WorkspaceTask) => void
  // Whether a task the server returns still belongs in THIS list (the flat list
  // holds goal-less tasks; a Goal holds its own).
  belongsInList: (task: WorkspaceTask) => boolean
}) {
  const latest = useRef({ onComplete, belongsInList, setError })
  latest.current = { onComplete, belongsInList, setError }

  useEffect(() => {
    if (!tasks || !userId) return
    const actor = { userId, isPersonal }
    const due = findDueTask(tasks, actor, now)
    if (!due) return

    const supabase = createClient()
    void runAutoCompletion(due, {
      actor,
      tracker: sessionCompletionTracker,
      clock: Date.now,
      // The database checks -- on its own clock, under the task's row lock --
      // that this is still the same run and really due, and completes it only
      // then (migration 0043). Tried on every completion rather than remembering
      // that it was missing once: completions are rare, and it starts working the
      // moment the migration is applied.
      completeGuarded: async task => {
        const { data, error } = await supabase.rpc(
          'auto_complete_workspace_task',
          {
            p_task_id: task.id,
            p_expected_started_at:
              task.startedAt === null
                ? null
                : new Date(task.startedAt).toISOString(),
          },
        )
        if (error) {
          if (isMissingFunctionError(error)) return { kind: 'unsupported' }
          throw error
        }
        return parseGuardedCompletion(data)
      },
      readCurrent: async taskId => {
        const { data, error } = await supabase
          .from('workspace_tasks')
          .select('*')
          .eq('id', taskId)
          .maybeSingle()
        if (error) throw error
        return data ? rowToTask(data as WorkspaceTaskRow) : null
      },
      reconcile: (taskId, current) =>
        setTasks(list =>
          current && latest.current.belongsInList(current)
            ? list.map(task => (task.id === taskId ? current : task))
            : list.filter(task => task.id !== taskId),
        ),
      announce: task => {
        notifyTaskCompletion(task.name)
        latest.current.onComplete?.(task)
      },
      showCompleted: (task, workedSeconds) =>
        setTasks(list =>
          list.map(existing =>
            existing.id === task.id
              ? {
                  ...existing,
                  status: 'completed',
                  workedSeconds,
                  startedAt: null,
                  completedAt: Date.now(),
                }
              : existing,
          ),
        ),
      revert: task =>
        setTasks(list =>
          list.map(existing => (existing.id === task.id ? task : existing)),
        ),
      complete: async taskId => {
        const { error } = await supabase.rpc('complete_workspace_task', {
          p_task_id: taskId,
          p_skip: false,
        })
        return !error
      },
      onFailure: () =>
        latest.current.setError("Couldn't save task completion."),
    })
  }, [tasks, userId, isPersonal, now, setTasks])
}
