import { TaskDependency, WorkspaceTask } from '@/types/workspace'

const DONE_STATUSES = new Set(['completed', 'skipped'])

// A task is ready once every task that blocks it is completed or skipped.
// Multiple blockers are AND'd together — still "simple" (no scheduling, no
// graph analysis), just more than a single predecessor.
export function isTaskReady(
  taskId: string,
  dependencies: TaskDependency[],
  tasksById: Map<string, WorkspaceTask>,
): boolean {
  return dependencies
    .filter(dep => dep.blockedTaskId === taskId)
    .every(dep => {
      const blocker = tasksById.get(dep.blockingTaskId)
      return blocker ? DONE_STATUSES.has(blocker.status) : true
    })
}

// The tasks currently blocking `taskId` (i.e. not yet completed/skipped) —
// what the UI shows as "Blocked by: X, Y".
export function blockingTasksFor(
  taskId: string,
  dependencies: TaskDependency[],
  tasksById: Map<string, WorkspaceTask>,
): WorkspaceTask[] {
  return dependencies
    .filter(dep => dep.blockedTaskId === taskId)
    .map(dep => tasksById.get(dep.blockingTaskId))
    .filter((task): task is WorkspaceTask => {
      if (!task) return false
      return !DONE_STATUSES.has(task.status)
    })
}

export function tasksById(tasks: WorkspaceTask[]): Map<string, WorkspaceTask> {
  return new Map(tasks.map(task => [task.id, task]))
}
