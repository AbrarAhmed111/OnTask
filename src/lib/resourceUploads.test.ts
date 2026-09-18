import { describe, expect, it } from 'vitest'
import {
  classifyUploadError,
  describeUploadOutcome,
  isCleanFinish,
  runWithConcurrency,
  summarizeUploads,
  uploadHeadline,
  uploadQueueReducer,
  UploadItem,
} from './resourceUploads'

const item = (
  id: string,
  status: UploadItem['status'] = 'uploading',
  error?: string,
): UploadItem => ({ id, fileName: `${id}.pdf`, fileSize: 10, status, error })

describe('uploadQueueReducer', () => {
  it('appends newly queued files without touching earlier ones', () => {
    const state = uploadQueueReducer([item('a', 'done')], {
      type: 'queued',
      items: [item('b'), item('c')],
    })
    expect(state.map(i => [i.id, i.status])).toEqual([
      ['a', 'done'],
      ['b', 'uploading'],
      ['c', 'uploading'],
    ])
  })

  it('finishes one file as done or as failed, independently of the others', () => {
    let state = [item('a'), item('b'), item('c')]
    state = uploadQueueReducer(state, { type: 'finished', id: 'a' })
    state = uploadQueueReducer(state, {
      type: 'finished',
      id: 'b',
      error: 'Too large',
    })
    expect(state.map(i => [i.id, i.status, i.error])).toEqual([
      ['a', 'done', undefined],
      ['b', 'error', 'Too large'],
      ['c', 'uploading', undefined],
    ])
  })

  it('dismissing keeps only files still uploading', () => {
    const state = uploadQueueReducer(
      [item('a', 'done'), item('b', 'error', 'x'), item('c')],
      { type: 'dismissed' },
    )
    expect(state.map(i => i.id)).toEqual(['c'])
  })
})

describe('summarizeUploads / uploadHeadline', () => {
  it('counts each state', () => {
    expect(
      summarizeUploads([
        item('a', 'done'),
        item('b', 'error', 'x'),
        item('c'),
        item('d', 'done'),
      ]),
    ).toEqual({ total: 4, uploading: 1, failed: 1, done: 2 })
  })

  it('describes progress, success and partial failure', () => {
    expect(uploadHeadline([item('a', 'done'), item('b')])).toBe(
      'Uploading resources… 1 of 2 finished',
    )
    expect(uploadHeadline([item('a', 'done')])).toBe('Resource uploaded')
    expect(uploadHeadline([item('a', 'done'), item('b', 'done')])).toBe(
      'All resources uploaded',
    )
    expect(uploadHeadline([item('a', 'done'), item('b', 'error', 'x')])).toBe(
      '1 uploaded, 1 failed',
    )
  })
})

describe('isCleanFinish', () => {
  it('is true only when every file uploaded', () => {
    expect(isCleanFinish([item('a', 'done'), item('b', 'done')])).toBe(true)
    expect(isCleanFinish([item('a', 'done'), item('b')])).toBe(false)
    expect(isCleanFinish([item('a', 'done'), item('b', 'error', 'x')])).toBe(
      false,
    )
    expect(isCleanFinish([])).toBe(false)
  })
})

describe('describeUploadOutcome', () => {
  it('celebrates a fully successful batch', () => {
    expect(describeUploadOutcome({ succeeded: 1, failed: 0 })).toEqual({
      tone: 'success',
      message: 'Resource uploaded.',
    })
    expect(describeUploadOutcome({ succeeded: 3, failed: 0 })).toEqual({
      tone: 'success',
      message: '3 resources uploaded.',
    })
  })
  it('reports a partial failure without hiding the successes', () => {
    expect(describeUploadOutcome({ succeeded: 2, failed: 1 })).toEqual({
      tone: 'error',
      message: '2 uploaded, 1 failed.',
    })
  })
  it('reports a total failure', () => {
    expect(describeUploadOutcome({ succeeded: 0, failed: 1 })?.message).toBe(
      "Couldn't upload the file.",
    )
    expect(describeUploadOutcome({ succeeded: 0, failed: 4 })?.message).toBe(
      "Couldn't upload 4 files.",
    )
  })
  it('says nothing for an empty batch', () => {
    expect(describeUploadOutcome({ succeeded: 0, failed: 0 })).toBeNull()
  })
})

describe('classifyUploadError', () => {
  it('recognises an oversized file', () => {
    expect(
      classifyUploadError({
        message: 'The object exceeded the maximum allowed size',
      }),
    ).toBe('Too large')
    expect(classifyUploadError({ status: 413, message: '' })).toBe('Too large')
  })
  it('uses a generic message otherwise', () => {
    expect(classifyUploadError({ message: 'network down' })).toBe(
      'Upload failed',
    )
    expect(classifyUploadError(null)).toBe('Upload failed')
  })
})

describe('runWithConcurrency', () => {
  it('never runs more than `limit` workers at once, and runs every item', async () => {
    let active = 0
    let peak = 0
    const done: number[] = []
    await runWithConcurrency([1, 2, 3, 4, 5, 6, 7], 3, async n => {
      active++
      peak = Math.max(peak, active)
      await new Promise(resolve => setTimeout(resolve, 5))
      done.push(n)
      active--
    })
    expect(peak).toBe(3)
    expect(done.sort()).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('lets the other files finish when one worker reports a failure', async () => {
    const outcomes: Record<string, 'done' | 'error'> = {}
    await runWithConcurrency(['ok-1', 'bad', 'ok-2', 'ok-3'], 2, async name => {
      // Mirrors the upload worker: it catches its own failure.
      try {
        if (name === 'bad') throw new Error('boom')
        outcomes[name] = 'done'
      } catch {
        outcomes[name] = 'error'
      }
    })
    expect(outcomes).toEqual({
      'ok-1': 'done',
      bad: 'error',
      'ok-2': 'done',
      'ok-3': 'done',
    })
  })

  it('copes with an empty list and a nonsensical limit', async () => {
    await expect(
      runWithConcurrency([], 3, async () => {}),
    ).resolves.toBeUndefined()
    const seen: number[] = []
    await runWithConcurrency([1, 2], 0, async n => {
      seen.push(n)
    })
    expect(seen).toEqual([1, 2])
  })
})
