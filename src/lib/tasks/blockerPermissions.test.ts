import { describe, expect, it } from 'vitest'
import {
  blockerResolvers,
  canBlockTask,
  canEditBlocker,
  canResolveBlocker,
} from '@/lib/tasks/blockerPermissions'
import type {
  TaskBlocker,
  WorkspaceMember,
  WorkspaceTask,
} from '@/types/workspace'

// Abrar is the assignee, Araysh is mentioned, Rachel takes over later; Olive
// owns the workspace but is neither; Sam is a bystander; Gone left the
// workspace after being mentioned.
const ABRAR = 'u-abrar'
const ARAYSH = 'u-araysh'
const RACHEL = 'u-rachel'
const OLIVE = 'u-olive-owner'
const SAM = 'u-sam'
const GONE = 'u-gone'
const MEMBERS = [ABRAR, ARAYSH, RACHEL, OLIVE, SAM]

const task = (
  overrides: Partial<Pick<WorkspaceTask, 'assignedTo' | 'status'>> = {},
) => ({
  assignedTo: ABRAR,
  status: 'queued' as WorkspaceTask['status'],
  ...overrides,
})

const blocker = (
  overrides: Partial<Pick<TaskBlocker, 'status' | 'mentionedUserIds'>> = {},
) => ({
  status: 'active' as TaskBlocker['status'],
  mentionedUserIds: [ARAYSH],
  ...overrides,
})

const as = (userId: string | undefined, isPersonal = false) => ({
  userId,
  isPersonal,
})

describe('canBlockTask', () => {
  it('lets the current assignee block a queued, working or paused task', () => {
    for (const status of ['queued', 'working', 'paused'] as const)
      expect(canBlockTask(task({ status }), as(ABRAR))).toBe(true)
  })

  it('does not let anyone else block it — owner and bystanders included', () => {
    for (const userId of [ARAYSH, OLIVE, SAM])
      expect(canBlockTask(task(), as(userId))).toBe(false)
  })

  it('does not let a previous assignee block it after a reassignment', () => {
    expect(canBlockTask(task({ assignedTo: RACHEL }), as(ABRAR))).toBe(false)
    expect(canBlockTask(task({ assignedTo: RACHEL }), as(RACHEL))).toBe(true)
  })

  it('offers nothing on an unassigned task, or without a signed-in user', () => {
    expect(canBlockTask(task({ assignedTo: null }), as(ABRAR))).toBe(false)
    expect(canBlockTask(task(), as(undefined))).toBe(false)
  })

  it('does not block a finished task or one that is already blocked', () => {
    for (const status of ['completed', 'skipped', 'blocked'] as const)
      expect(canBlockTask(task({ status }), as(ABRAR))).toBe(false)
  })

  it('does not block a task that only groups subtasks', () => {
    expect(canBlockTask(task(), as(ABRAR), true)).toBe(false)
  })

  it('does nothing in a personal workspace', () => {
    expect(canBlockTask(task(), as(ABRAR, true))).toBe(false)
  })
})

describe('canEditBlocker', () => {
  it('is the current assignee, on an active blocker', () => {
    expect(canEditBlocker(task(), blocker(), as(ABRAR))).toBe(true)
    expect(canEditBlocker(task(), blocker(), as(ARAYSH))).toBe(false)
    expect(canEditBlocker(task(), blocker(), as(OLIVE))).toBe(false)
  })

  it('moves to the new assignee on reassignment', () => {
    const reassigned = task({ assignedTo: RACHEL })
    expect(canEditBlocker(reassigned, blocker(), as(ABRAR))).toBe(false)
    expect(canEditBlocker(reassigned, blocker(), as(RACHEL))).toBe(true)
  })

  it('is closed once the blocker is resolved', () => {
    expect(
      canEditBlocker(task(), blocker({ status: 'resolved' }), as(ABRAR)),
    ).toBe(false)
  })
})

describe('canResolveBlocker', () => {
  const can = (
    userId: string | undefined,
    options: {
      task?: ReturnType<typeof task>
      blocker?: ReturnType<typeof blocker>
      members?: string[]
    } = {},
  ) =>
    canResolveBlocker(
      options.task ?? task({ status: 'blocked' }),
      options.blocker ?? blocker(),
      as(userId),
      options.members ?? MEMBERS,
    )

  it('lets the current assignee resolve it', () => {
    expect(can(ABRAR)).toBe(true)
  })

  it('lets a mentioned member resolve it', () => {
    expect(can(ARAYSH)).toBe(true)
  })

  it('lets every mentioned member resolve it, not just one', () => {
    const b = blocker({ mentionedUserIds: [ARAYSH, SAM] })
    expect(can(ARAYSH, { blocker: b })).toBe(true)
    expect(can(SAM, { blocker: b })).toBe(true)
  })

  it('does not let a member who was not mentioned resolve it', () => {
    expect(can(SAM)).toBe(false)
  })

  it('gives the workspace owner no bypass', () => {
    expect(can(OLIVE)).toBe(false)
  })

  it('does not let a previous assignee resolve it after a reassignment', () => {
    const reassigned = task({ status: 'blocked', assignedTo: RACHEL })
    expect(can(ABRAR, { task: reassigned })).toBe(false)
    expect(can(RACHEL, { task: reassigned })).toBe(true)
    // ...but a mention still counts for whoever it names.
    expect(can(ARAYSH, { task: reassigned })).toBe(true)
  })

  it('takes the right away when a mention is removed', () => {
    expect(can(ARAYSH, { blocker: blocker({ mentionedUserIds: [] }) })).toBe(
      false,
    )
  })

  it('does not let a removed member resolve it, mentioned or not', () => {
    const b = blocker({ mentionedUserIds: [GONE] })
    expect(can(GONE, { blocker: b })).toBe(false)
    expect(can(ARAYSH, { blocker: b, members: [ABRAR, OLIVE] })).toBe(false)
  })

  it('leaves the assignee able to resolve even if every mention is gone', () => {
    const b = blocker({ mentionedUserIds: [] })
    expect(can(ABRAR, { blocker: b })).toBe(true)
  })

  it('is closed once the blocker is resolved', () => {
    expect(can(ABRAR, { blocker: blocker({ status: 'resolved' }) })).toBe(false)
  })

  it('offers nothing without a signed-in user or in a personal workspace', () => {
    expect(can(undefined)).toBe(false)
    expect(canResolveBlocker(task(), blocker(), as(ABRAR, true), MEMBERS)).toBe(
      false,
    )
  })

  it('decides from user ids, never from a display name', () => {
    // Two people can share a name; the one who was not mentioned stays out.
    const b = blocker({ mentionedUserIds: ['u-abrar-ahmed-1'] })
    expect(
      can('u-abrar-ahmed-2', {
        blocker: b,
        members: [...MEMBERS, 'u-abrar-ahmed-1', 'u-abrar-ahmed-2'],
      }),
    ).toBe(false)
    expect(
      can('u-abrar-ahmed-1', {
        blocker: b,
        members: [...MEMBERS, 'u-abrar-ahmed-1', 'u-abrar-ahmed-2'],
      }),
    ).toBe(true)
  })
})

describe('blockerResolvers', () => {
  const member = (userId: string, fullName: string): WorkspaceMember => ({
    id: `m-${userId}`,
    workspaceId: 'w1',
    userId,
    role: 'member',
    joinedAt: '2026-01-01',
    fullName,
    email: `${userId}@example.com`,
    avatarUrl: null,
  })
  const members = [member(ABRAR, 'Abrar'), member(ARAYSH, 'Araysh')]

  it('lists the assignee first, then the members named', () => {
    expect(
      blockerResolvers(task(), blocker(), members).map(m => m.userId),
    ).toEqual([ABRAR, ARAYSH])
  })

  it('lists someone once even if they are both', () => {
    expect(
      blockerResolvers(
        task(),
        blocker({ mentionedUserIds: [ABRAR, ARAYSH] }),
        members,
      ).map(m => m.userId),
    ).toEqual([ABRAR, ARAYSH])
  })

  it('leaves out anyone who is no longer in the workspace', () => {
    expect(
      blockerResolvers(
        task(),
        blocker({ mentionedUserIds: [GONE] }),
        members,
      ).map(m => m.userId),
    ).toEqual([ABRAR])
  })
})
