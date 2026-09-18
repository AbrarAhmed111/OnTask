import { createClient } from '@/lib/supabase/client'
import { getLiveSeconds } from '@/hooks/useTimer'
import { Task } from '@/types'

export type MigrationResult =
  { success: true; imported: number } | { success: false; error: string }

// Saves a guest's local tasks into their Personal Workspace, in one atomic
// database call (see supabase/migrations/0031_import_guest_tasks_to_personal_
// workspace.sql for the exact mapping — subtasks become a Goal, statuses map
// onto workspace statuses, recorded time is carried over).
//
// A locally-running task has no cloud timer to hand over, so it's sent with
// the time it had accumulated and the database parks it as paused.
export async function importGuestTasksToPersonalWorkspace(
  localTasks: Task[],
): Promise<MigrationResult> {
  const now = Date.now()
  const payload = localTasks.map(task => ({
    id: task.id,
    parent_task_id: task.parentTaskId,
    title: task.name,
    planned_seconds: task.plannedMinutes * 60,
    actual_seconds: Math.round(getLiveSeconds(task, now)),
    status: task.status,
    progress_label: task.progressLabel ?? null,
    progress_percentage: task.progressPercentage ?? null,
  }))

  const supabase = createClient()
  const { data, error } = await supabase.rpc(
    'import_guest_tasks_to_personal_workspace',
    { p_tasks: payload },
  )
  if (error) return { success: false, error: error.message }
  return { success: true, imported: typeof data === 'number' ? data : 0 }
}
