import type { WorkspaceTask } from '@/types/workspace'

// Who may drive a workspace task's timer. The database is what actually
// enforces this (supabase/migrations/0035_task_timer_permissions.sql,
// is_workspace_task_timer_controller); this mirrors that rule so the UI can
// hide what would be rejected and the hooks don't send requests that are
// certain to fail. Keep the two in step.
//
// The task's CURRENT assignee — and nobody else — controls its timer, so
// reassigning hands the permission over on the spot. An unassigned task has
// no controller. The one exception is a personal workspace: it has no
// assignment step (the picker is hidden and its tasks are never assigned), so
// its sole member is treated as the assignee.

export type TimerActor = {
  userId: string | undefined
  isPersonal: boolean
  isOwner: boolean
}

export function canControlTimer(
  task: Pick<WorkspaceTask, 'assignedTo'>,
  actor: Pick<TimerActor, 'userId' | 'isPersonal'>,
): boolean {
  if (!actor.userId) return false
  if (task.assignedTo === null) return actor.isPersonal
  return task.assignedTo === actor.userId
}

// The owner's separate override for someone else's running timer. It can only
// stop: an owner who isn't the assignee never gets start/resume, since that
// would book the work to the wrong person.
export function canEmergencyStop(
  task: Pick<WorkspaceTask, 'assignedTo' | 'status'>,
  actor: TimerActor,
): boolean {
  return (
    actor.isOwner && task.status === 'working' && !canControlTimer(task, actor)
  )
}

// Why the timer is locked for this actor, or null when they can use it.
export function timerLockReason(
  task: Pick<WorkspaceTask, 'assignedTo'>,
  actor: Pick<TimerActor, 'userId' | 'isPersonal'>,
): string | null {
  if (canControlTimer(task, actor)) return null
  return task.assignedTo === null
    ? 'Assign this task to a member to use its timer'
    : 'Only the assigned member can control this timer'
}
