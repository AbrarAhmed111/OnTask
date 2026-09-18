// A completed task whose planned time is raised above what has been worked
// still has work left, so it stops being "complete" and goes back to paused —
// the state the card already offers Resume for. Nothing starts on its own.
//
// For workspace tasks the database is what actually does this, in the same
// write as the time edit (supabase/migrations/0037_reopen_task_on_extended_time.sql,
// reopen_workspace_task_on_extend), because clients can't write a task's
// status directly. This mirrors that rule so the UI updates before the round
// trip and guest (local-only) tasks behave the same. Keep the two in step.
//
// Only 'completed' reopens. A 'skipped' task was ended on purpose ("finished
// for today"), so giving it more time doesn't undo that. And the new plan has
// to exceed the time already worked — otherwise the task would be paused with
// nothing left to do.

export function shouldReopenOnExtend(
  task: { status: string; plannedMinutes: number; workedSeconds: number },
  newPlannedMinutes: number | undefined,
): boolean {
  return (
    task.status === 'completed' &&
    newPlannedMinutes !== undefined &&
    newPlannedMinutes > task.plannedMinutes &&
    task.workedSeconds < newPlannedMinutes * 60
  )
}
