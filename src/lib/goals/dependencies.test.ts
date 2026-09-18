import { describe, expect, it } from 'vitest'
import { blockingTasksFor, isTaskReady, tasksById } from './dependencies'
import { TaskDependency, WorkspaceTask } from '@/types/workspace'

function task(id: string, status: WorkspaceTask['status']): WorkspaceTask {
  return {
    id,
    workspaceId: 'w1',
    parentTaskId: null,
    goalId: 'g1',
    createdBy: 'u1',
    assignedTo: null,
    name: id,
    plannedMinutes: 60,
    workedSeconds: 0,
    status,
    startedAt: null,
    completedAt: null,
  }
}

function dep(blockingTaskId: string, blockedTaskId: string): TaskDependency {
  return {
    id: `${blockingTaskId}->${blockedTaskId}`,
    workspaceId: 'w1',
    goalId: 'g1',
    blockingTaskId,
    blockedTaskId,
    createdBy: 'u1',
    createdAt: new Date().toISOString(),
  }
}

describe('isTaskReady', () => {
  it('is ready when it has no dependencies at all', () => {
    const tasks = [task('a', 'queued')]
    expect(isTaskReady('a', [], tasksById(tasks))).toBe(true)
  })

  it('is blocked while its single blocker is not done', () => {
    const tasks = [task('a', 'working'), task('b', 'queued')]
    const deps = [dep('a', 'b')]
    expect(isTaskReady('b', deps, tasksById(tasks))).toBe(false)
  })

  it('becomes ready once the blocker completes', () => {
    const tasks = [task('a', 'completed'), task('b', 'queued')]
    const deps = [dep('a', 'b')]
    expect(isTaskReady('b', deps, tasksById(tasks))).toBe(true)
  })

  it('treats a skipped blocker as satisfied, same as completed', () => {
    const tasks = [task('a', 'skipped'), task('b', 'queued')]
    const deps = [dep('a', 'b')]
    expect(isTaskReady('b', deps, tasksById(tasks))).toBe(true)
  })

  it('requires every blocker to finish (AND semantics) with multiple blockers', () => {
    const tasks = [
      task('a', 'completed'),
      task('b', 'working'),
      task('c', 'queued'),
    ]
    const deps = [dep('a', 'c'), dep('b', 'c')]
    expect(isTaskReady('c', deps, tasksById(tasks))).toBe(false)

    const allDone = [
      task('a', 'completed'),
      task('b', 'completed'),
      task('c', 'queued'),
    ]
    expect(isTaskReady('c', deps, tasksById(allDone))).toBe(true)
  })
})

describe('blockingTasksFor', () => {
  it('returns only the still-incomplete blockers', () => {
    const tasks = [
      task('a', 'completed'),
      task('b', 'working'),
      task('c', 'queued'),
    ]
    const deps = [dep('a', 'c'), dep('b', 'c')]
    const blockers = blockingTasksFor('c', deps, tasksById(tasks))
    expect(blockers.map(t => t.id)).toEqual(['b'])
  })

  it('returns an empty list once all blockers are done', () => {
    const tasks = [task('a', 'completed'), task('b', 'queued')]
    const deps = [dep('a', 'b')]
    expect(blockingTasksFor('b', deps, tasksById(tasks))).toEqual([])
  })
})
