import { describe, expect, it } from 'vitest'
import { mergeById } from './mergeById'

type Row = { id: string; createdAt: number }

describe('mergeById', () => {
  it('appends a genuinely new row', () => {
    const existing: Row[] = [{ id: 'a', createdAt: 1 }]
    const merged = mergeById(
      existing,
      [{ id: 'b', createdAt: 2 }],
      r => r.createdAt,
    )
    expect(merged.map(r => r.id)).toEqual(['b', 'a'])
  })

  it('does not duplicate a row delivered twice (reconnect resend, double realtime event)', () => {
    const existing: Row[] = [{ id: 'a', createdAt: 1 }]
    const merged = mergeById(
      existing,
      [{ id: 'a', createdAt: 1 }],
      r => r.createdAt,
    )
    expect(merged).toHaveLength(1)
  })

  it('reconciles an optimistic row with its realtime-confirmed version by sharing the same id', () => {
    const optimistic: Row[] = [{ id: 'temp-1', createdAt: 1 }]
    const confirmed = mergeById(
      optimistic,
      [{ id: 'temp-1', createdAt: 5 }],
      r => r.createdAt,
    )
    expect(confirmed).toEqual([{ id: 'temp-1', createdAt: 5 }])
  })

  it('sorts newest first by the given sort key', () => {
    const existing: Row[] = [
      { id: 'a', createdAt: 1 },
      { id: 'c', createdAt: 3 },
    ]
    const merged = mergeById(
      existing,
      [{ id: 'b', createdAt: 2 }],
      r => r.createdAt,
    )
    expect(merged.map(r => r.id)).toEqual(['c', 'b', 'a'])
  })

  it('caps the result to the given limit', () => {
    const existing: Row[] = [
      { id: 'a', createdAt: 1 },
      { id: 'b', createdAt: 2 },
      { id: 'c', createdAt: 3 },
    ]
    const merged = mergeById(
      existing,
      [{ id: 'd', createdAt: 4 }],
      r => r.createdAt,
      2,
    )
    expect(merged.map(r => r.id)).toEqual(['d', 'c'])
  })
})
