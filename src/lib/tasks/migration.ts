import { createClient } from '@/lib/supabase/client'
import { getLiveSeconds } from '@/hooks/useTimer'
import { Task } from '@/types'
import { taskStatusToRow } from '@/lib/tasks/mappers'

export type MigrationResult =
  { success: true } | { success: false; error: string }

// A locally-active task has no cloud equivalent to hand its running timer to
// (there's no cross-device "resume this" concept), so it's frozen as paused
// at whatever it had accumulated — same treatment start_personal_task already
// gives any other task that gets parked when a new one starts.
export async function migrateGuestTasks(
  localTasks: Task[],
): Promise<MigrationResult> {
  const now = Date.now()
  const payload = localTasks.map(task => {
    const status = task.status === 'active' ? 'paused' : task.status
    return {
      id: task.id,
      parent_task_id: task.parentTaskId,
      title: task.name,
      planned_seconds: task.plannedMinutes * 60,
      actual_seconds: Math.round(getLiveSeconds(task, now)),
      status: taskStatusToRow(status),
      goal_name: task.goalName ?? null,
      goal_percentage: task.goalProgress ?? null,
    }
  })

  const supabase = createClient()
  const { error } = await supabase.rpc('migrate_guest_tasks', {
    p_tasks: payload,
  })
  if (error) return { success: false, error: error.message }
  return { success: true }
}
