import { describe, expect, it } from 'vitest'
import {
  BlockerRowState,
  MentionRowState,
  activeBlockers,
  applyBlockerRow,
  applyMentionRow,
  blockedTaskState,
  blockerForTask,
  optimisticBlockerRows,
  removeById,
  resolvedTaskState,
  sanitizeMentionedUserIds,
} from '@/lib/tasks/blockers'
import { getWorkspaceLiveSeconds } from '@/lib/tasks/workspaceMappers'
import type { WorkspaceTask } from '@/types/workspace'

const blockerRow = (
  overrides: Partial<BlockerRowState> = {},
): BlockerRowState => ({
  id: 'b-1',
  task_id: 't-1',
  workspace_id: 'w-1',
  created_by: 'u-abrar',
  reason: 'Waiting for API credentials from @Araysh.',
  status: 'active',
  created_at: '2026-09-19T10:00:00.000Z',
  updated_at: '2026-09-19T10:00:00.000Z',
  resolved_at: null,
  resolved_by: null,
  resolution_note: null,
  ...overrides,
})

const mentionRow = (
  overrides: Partial<MentionRowState> = {},
): MentionRowState => ({
  id: 'm-1',
  blocker_id: 'b-1',
  workspace_id: 'w-1',
  mentioned_user_id: 'u-araysh',
  added_by: 'u-abrar',
  created_at: '2026-09-19T10:00:00.000Z',
  removed_at: null,
  ...overrides,
})

const task = (overrides: Partial<WorkspaceTask> = {}): WorkspaceTask => ({
  id: 't-1',
  workspaceId: 'w-1',
  parentTaskId: null,
  goalId: null,
  createdBy: 'u-abrar',
  assignedTo: 'u-abrar',
  name: 'Student API',
  plannedMinutes: 60,
  workedSeconds: 100,
  status: 'queued',
  startedAt: null,
  completedAt: null,
  ...overrides,
})

describe('the task state when blocked', () => {
  const NOW = 1_000_000_000_000

  it('stops a running task and keeps the time already recorded', () => {
    const running = task({
      status: 'working',
      workedSeconds: 100,
      startedAt: NOW - 50_000,
    })
    expect(blockedTaskState(running, NOW)).toEqual({
      status: 'blocked',
      workedSeconds: 150,
      startedAt: null,
    })
  })

  it('records no further time while blocked — blocked time is not focused time', () => {
    const running = task({
      status: 'working',
      workedSeconds: 100,
      startedAt: NOW - 50_000,
    })
    const blocked = { ...running, ...blockedTaskState(running, NOW) }
    expect(getWorkspaceLiveSeconds(blocked, NOW)).toBe(150)
    // An hour and a day later, still the same 150 seconds.
    expect(getWorkspaceLiveSeconds(blocked, NOW + 3_600_000)).toBe(150)
    expect(getWorkspaceLiveSeconds(blocked, NOW + 86_400_000)).toBe(150)
  })

  it('leaves the recorded time of an idle task exactly as it was', () => {
    expect(blockedTaskState(task({ workedSeconds: 240 }), NOW)).toEqual({
      status: 'blocked',
      workedSeconds: 240,
      startedAt: null,
    })
  })
})

describe('the task state when its blocker is resolved', () => {
  it('goes Blocked -> Queued', () => {
    expect(resolvedTaskState().status).toBe('queued')
  })

  it('does not start the timer', () => {
    const blocked = task({ status: 'blocked', workedSeconds: 150 })
    const resolved = { ...blocked, ...resolvedTaskState() }
    expect(resolved.status).not.toBe('working')
    expect(resolved.startedAt).toBeNull()
    // No clock is running, so no time accrues after resolving either.
    expect(getWorkspaceLiveSeconds(resolved, Date.now() + 86_400_000)).toBe(150)
  })
})

describe('applyBlockerRow', () => {
  it('adds a blocker it has not seen', () => {
    expect(applyBlockerRow([], blockerRow())).toHaveLength(1)
  })

  it('does not duplicate a redelivered event', () => {
    const once = applyBlockerRow([], blockerRow())
    const twice = applyBlockerRow(once, blockerRow())
    expect(twice).toHaveLength(1)
  })

  it('lets the server row replace the optimistic one with the same id', () => {
    const optimistic = blockerRow({ optimistic: true, reason: 'typed reason' })
    const server = blockerRow({
      reason: 'typed reason',
      updated_at: '2026-09-19T10:00:05.000Z',
    })
    const result = applyBlockerRow([optimistic], server)
    expect(result).toEqual([server])
    expect(result[0].optimistic).toBeUndefined()
  })

  it('never lets an optimistic row overwrite the server row', () => {
    const server = blockerRow()
    const result = applyBlockerRow(
      [server],
      blockerRow({ optimistic: true, reason: 'x' }),
    )
    expect(result).toEqual([server])
  })

  it('ignores a late delivery older than what it already has', () => {
    const newer = blockerRow({
      reason: 'edited',
      updated_at: '2026-09-19T11:00:00.000Z',
    })
    const older = blockerRow({
      reason: 'original',
      updated_at: '2026-09-19T10:00:00.000Z',
    })
    expect(applyBlockerRow([newer], older)[0].reason).toBe('edited')
  })

  it('applies a newer delivery over an older one', () => {
    const older = blockerRow({ reason: 'original' })
    const newer = blockerRow({
      reason: 'edited',
      updated_at: '2026-09-19T11:00:00.000Z',
    })
    expect(applyBlockerRow([older], newer)[0].reason).toBe('edited')
  })

  it('never brings a resolved blocker back to active from a stale event', () => {
    const resolved = blockerRow({
      status: 'resolved',
      resolved_at: '2026-09-19T12:00:00.000Z',
      resolved_by: 'u-araysh',
      updated_at: '2026-09-19T12:00:00.000Z',
    })
    // Same updated_at on purpose: the terminal state wins regardless of clocks.
    const stale = blockerRow({
      status: 'active',
      updated_at: '2026-09-19T12:00:00.000Z',
    })
    expect(applyBlockerRow([resolved], stale)[0].status).toBe('resolved')
  })

  it('does not touch other blockers', () => {
    const other = blockerRow({ id: 'b-2', task_id: 't-2' })
    const result = applyBlockerRow([other], blockerRow({ reason: 'new' }))
    expect(result).toHaveLength(2)
    expect(result.find(r => r.id === 'b-2')).toEqual(other)
  })
})

describe('applyMentionRow', () => {
  it('replaces the optimistic placeholder with the real row for the same person', () => {
    const [optimistic] = optimisticBlockerRows({
      id: 'b-1',
      task: { id: 't-1', workspaceId: 'w-1' },
      userId: 'u-abrar',
      reason: 'x',
      mentionedUserIds: ['u-araysh'],
    }).mentions
    const result = applyMentionRow([optimistic], mentionRow())
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('m-1')
    expect(result[0].optimistic).toBeUndefined()
  })

  it('does not duplicate a redelivered mention', () => {
    const once = applyMentionRow([], mentionRow())
    expect(applyMentionRow(once, mentionRow())).toHaveLength(1)
  })

  it('never reactivates a removed mention from a stale event', () => {
    const removed = mentionRow({ removed_at: '2026-09-19T11:00:00.000Z' })
    const result = applyMentionRow([removed], mentionRow({ removed_at: null }))
    expect(result[0].removed_at).not.toBeNull()
  })

  it('records a removal', () => {
    const result = applyMentionRow(
      [mentionRow()],
      mentionRow({ removed_at: '2026-09-19T11:00:00.000Z' }),
    )
    expect(result[0].removed_at).toBe('2026-09-19T11:00:00.000Z')
  })
})

describe('activeBlockers', () => {
  it('joins each active blocker with the members it currently names', () => {
    const result = activeBlockers(
      [blockerRow()],
      [mentionRow(), mentionRow({ id: 'm-2', mentioned_user_id: 'u-rachel' })],
    )
    expect(result).toHaveLength(1)
    expect(result[0].mentionedUserIds).toEqual(['u-araysh', 'u-rachel'])
    expect(result[0]).toMatchObject({
      id: 'b-1',
      taskId: 't-1',
      workspaceId: 'w-1',
      createdBy: 'u-abrar',
      status: 'active',
    })
  })

  it('leaves a removed mention out — they no longer count', () => {
    const result = activeBlockers(
      [blockerRow()],
      [mentionRow({ removed_at: '2026-09-19T11:00:00.000Z' })],
    )
    expect(result[0].mentionedUserIds).toEqual([])
  })

  it('names someone once even when both a placeholder and the real row exist', () => {
    const [placeholder] = optimisticBlockerRows({
      id: 'b-1',
      task: { id: 't-1', workspaceId: 'w-1' },
      userId: 'u-abrar',
      reason: 'x',
      mentionedUserIds: ['u-araysh'],
    }).mentions
    const result = activeBlockers([blockerRow()], [placeholder, mentionRow()])
    expect(result[0].mentionedUserIds).toEqual(['u-araysh'])
  })

  it('does not mix up two blockers’ mentions', () => {
    const result = activeBlockers(
      [blockerRow(), blockerRow({ id: 'b-2', task_id: 't-2' })],
      [
        mentionRow(),
        mentionRow({
          id: 'm-2',
          blocker_id: 'b-2',
          mentioned_user_id: 'u-sam',
        }),
      ],
    )
    expect(result.find(b => b.id === 'b-1')?.mentionedUserIds).toEqual([
      'u-araysh',
    ])
    expect(result.find(b => b.id === 'b-2')?.mentionedUserIds).toEqual([
      'u-sam',
    ])
  })

  it('returns only ACTIVE blockers — a resolved one is history', () => {
    const result = activeBlockers(
      [
        blockerRow({
          status: 'resolved',
          resolved_at: '2026-09-19T12:00:00.000Z',
        }),
      ],
      [],
    )
    expect(result).toEqual([])
  })

  it('has one active blocker per task, so a task resolves to exactly that one', () => {
    const list = activeBlockers([blockerRow()], [])
    expect(blockerForTask(list, 't-1')?.id).toBe('b-1')
    expect(blockerForTask(list, 't-other')).toBeUndefined()
  })
})

describe('optimisticBlockerRows', () => {
  it('uses the given id and one placeholder per mentioned member', () => {
    const { blocker, mentions } = optimisticBlockerRows({
      id: 'b-9',
      task: { id: 't-1', workspaceId: 'w-1' },
      userId: 'u-abrar',
      reason: 'Waiting',
      mentionedUserIds: ['u-a', 'u-b'],
    })
    expect(blocker).toMatchObject({
      id: 'b-9',
      status: 'active',
      optimistic: true,
    })
    expect(mentions.map(m => m.mentioned_user_id)).toEqual(['u-a', 'u-b'])
    expect(mentions.every(m => m.blocker_id === 'b-9' && m.optimistic)).toBe(
      true,
    )
  })
})

describe('removeById', () => {
  it('removes only that row', () => {
    expect(
      removeById([blockerRow(), blockerRow({ id: 'b-2' })], 'b-1'),
    ).toEqual([blockerRow({ id: 'b-2' })])
  })
})

describe('sanitizeMentionedUserIds', () => {
  const members = ['u-abrar', 'u-araysh', 'u-rachel']

  it('keeps current members, each once', () => {
    expect(
      sanitizeMentionedUserIds(
        ['u-araysh', 'u-rachel', 'u-araysh'],
        'u-abrar',
        members,
      ),
    ).toEqual(['u-araysh', 'u-rachel'])
  })

  it('never includes the person raising the blocker', () => {
    expect(
      sanitizeMentionedUserIds(['u-abrar', 'u-araysh'], 'u-abrar', members),
    ).toEqual(['u-araysh'])
  })

  it('drops anyone who is not in the workspace', () => {
    expect(
      sanitizeMentionedUserIds(['u-outsider', 'u-araysh'], 'u-abrar', members),
    ).toEqual(['u-araysh'])
  })

  it('keeps two same-named people apart because it works on ids', () => {
    expect(
      sanitizeMentionedUserIds(['u-abrar-1', 'u-abrar-2'], 'u-rachel', [
        ...members,
        'u-abrar-1',
        'u-abrar-2',
      ]),
    ).toEqual(['u-abrar-1', 'u-abrar-2'])
  })
})
