import { Task, TaskStatus } from '@/types'

export type PersonalTaskRow = {
  id: string
  user_id: string
  parent_task_id: string | null
  title: string
  description: string | null
  planned_seconds: number
  actual_seconds: number
  status: 'pending' | 'working' | 'paused' | 'completed' | 'skipped'
  progress_label: string | null
  progress_percentage: number | null
  position: number
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

const DB_TO_UI_STATUS: Record<PersonalTaskRow['status'], TaskStatus> = {
  pending: 'pending',
  working: 'active',
  paused: 'paused',
  completed: 'completed',
  skipped: 'skipped',
}

const UI_TO_DB_STATUS: Record<TaskStatus, PersonalTaskRow['status']> = {
  pending: 'pending',
  active: 'working',
  paused: 'paused',
  completed: 'completed',
  skipped: 'skipped',
}

export function rowToTask(row: PersonalTaskRow): Task {
  return {
    id: row.id,
    name: row.title,
    plannedMinutes: Math.round(row.planned_seconds / 60),
    workedSeconds: row.actual_seconds,
    status: DB_TO_UI_STATUS[row.status],
    progressLabel: row.progress_label ?? undefined,
    progressPercentage: row.progress_percentage ?? undefined,
    startedAt: row.started_at ? new Date(row.started_at).getTime() : null,
    parentTaskId: row.parent_task_id,
  }
}

export function taskStatusToRow(status: TaskStatus): PersonalTaskRow['status'] {
  return UI_TO_DB_STATUS[status]
}

type PatchableRowFields = Pick<
  PersonalTaskRow,
  | 'title'
  | 'planned_seconds'
  | 'progress_label'
  | 'progress_percentage'
  | 'parent_task_id'
>

// Used by the generic updateTask() path (title/plannedMinutes/goal edits,
// and moving a task to a different parent or making it standalone) —
// startedAt/status/workedSeconds are never sent this way; those are owned by
// the start/pause/complete RPCs.
export function taskPatchToRow(
  patch: Partial<Task>,
): Partial<PatchableRowFields> {
  const row: Partial<PatchableRowFields> = {}
  if (patch.name !== undefined) row.title = patch.name
  if (patch.plannedMinutes !== undefined)
    row.planned_seconds = patch.plannedMinutes * 60
  if (patch.progressLabel !== undefined)
    row.progress_label = patch.progressLabel ?? null
  if (patch.progressPercentage !== undefined)
    row.progress_percentage = patch.progressPercentage ?? null
  if (patch.parentTaskId !== undefined) row.parent_task_id = patch.parentTaskId
  return row
}
