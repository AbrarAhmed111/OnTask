import { describe, expect, it } from 'vitest'
import { filterUnresolvedTasks } from '@/lib/storage'
import { Task } from '@/types'

const task = (id: string): Task => ({
  id,
  name: `Task ${id}`,
  plannedMinutes: 30,
  workedSeconds: 0,
  status: 'pending',
  startedAt: null,
  parentTaskId: null,
})

describe('filterUnresolvedTasks', () => {
  it('offers every task when none have been answered for', () => {
    const tasks = [task('a'), task('b')]
    expect(filterUnresolvedTasks(tasks, new Set())).toEqual(tasks)
  })

  it('leaves out tasks the user already answered for', () => {
    const tasks = [task('a'), task('b'), task('c')]
    expect(filterUnresolvedTasks(tasks, new Set(['a', 'c']))).toEqual([
      task('b'),
    ])
  })

  it('offers tasks added after an earlier "Start Fresh"', () => {
    // "a" was resolved last login; "d" is new guest work since then.
    const tasks = [task('a'), task('d')]
    expect(filterUnresolvedTasks(tasks, new Set(['a']))).toEqual([task('d')])
  })

  it('returns nothing when everything is resolved', () => {
    expect(filterUnresolvedTasks([task('a')], new Set(['a']))).toEqual([])
  })
})
