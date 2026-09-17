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
  goal_name: string | null
  goal_percentage: number | null
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
    goalName: row.goal_name ?? undefined,
    goalProgress: row.goal_percentage ?? undefined,
    startedAt: row.started_at ? new Date(row.started_at).getTime() : null,
  }
}

export function taskStatusToRow(status: TaskStatus): PersonalTaskRow['status'] {
  return UI_TO_DB_STATUS[status]
}

// Used by the generic updateTask() path (title/plannedMinutes/goal edits) —
// startedAt/status/workedSeconds are never sent this way; those are owned by
// the start/pause/complete RPCs.
export function taskPatchToRow(
  patch: Partial<Task>,
): Partial<
  Pick<
    PersonalTaskRow,
    'title' | 'planned_seconds' | 'goal_name' | 'goal_percentage'
  >
> {
  const row: Partial<
    Pick<
      PersonalTaskRow,
      'title' | 'planned_seconds' | 'goal_name' | 'goal_percentage'
    >
  > = {}
  if (patch.name !== undefined) row.title = patch.name
  if (patch.plannedMinutes !== undefined)
    row.planned_seconds = patch.plannedMinutes * 60
  if (patch.goalName !== undefined) row.goal_name = patch.goalName ?? null
  if (patch.goalProgress !== undefined)
    row.goal_percentage = patch.goalProgress ?? null
  return row
}
