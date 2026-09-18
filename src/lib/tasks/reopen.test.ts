import { describe, expect, it } from 'vitest'
import { shouldReopenOnExtend } from '@/lib/tasks/reopen'

const task = (status: string, plannedMinutes = 30, workedSeconds = 1800) => ({
  status,
  plannedMinutes,
  workedSeconds,
})

describe('shouldReopenOnExtend', () => {
  it('reopens a completed task given more time than was worked', () => {
    expect(shouldReopenOnExtend(task('completed'), 45)).toBe(true)
  })

  it('reopens when the raise is smaller than the gap to the worked time', () => {
    // Finished early at 20 of 30 minutes, then raised to 40.
    expect(shouldReopenOnExtend(task('completed', 30, 1200), 40)).toBe(true)
  })

  it('leaves the task alone when the time is not increased', () => {
    expect(shouldReopenOnExtend(task('completed'), 30)).toBe(false)
    expect(shouldReopenOnExtend(task('completed'), 20)).toBe(false)
  })

  it('leaves the task alone when the edit does not touch the time', () => {
    expect(shouldReopenOnExtend(task('completed'), undefined)).toBe(false)
  })

  it('does not reopen when the new plan is still covered by the time worked', () => {
    // Worked 40 of a planned 30, raised to 35: still nothing left to do.
    expect(shouldReopenOnExtend(task('completed', 30, 2400), 35)).toBe(false)
    expect(shouldReopenOnExtend(task('completed', 30, 2400), 40)).toBe(false)
  })

  it('only reopens completed tasks', () => {
    for (const status of [
      'skipped',
      'paused',
      'queued',
      'working',
      'pending',
      'active',
    ]) {
      expect(shouldReopenOnExtend(task(status), 60)).toBe(false)
    }
  })
})
