import { describe, expect, it } from 'vitest'
import { formatHM } from './time'

describe('formatHM', () => {
  it('formats the exact scenario that motivated centralizing this formatter', () => {
    // Abrar: 3h 0m, Rachel: 1h 49m, total: 4h 49m -- these three must always
    // agree, since they're all derived from the same formatter.
    expect(formatHM(10800)).toBe('3h 0m')
    expect(formatHM(6540)).toBe('1h 49m')
    expect(formatHM(17340)).toBe('4h 49m')
  })

  it('floors partial minutes rather than rounding them', () => {
    // 2970s = 49.5 minutes past the hour -- must floor to 49, never round up
    // to 50 (that mismatch, floor vs round, is exactly the class of bug this
    // shared formatter exists to prevent).
    expect(formatHM(3600 + 2970)).toBe('1h 49m')
  })

  it('handles zero and sub-minute durations', () => {
    expect(formatHM(0)).toBe('0h 0m')
    expect(formatHM(45)).toBe('0h 0m')
  })

  it('never goes negative for a negative input', () => {
    expect(formatHM(-100)).toBe('0h 0m')
  })
})
