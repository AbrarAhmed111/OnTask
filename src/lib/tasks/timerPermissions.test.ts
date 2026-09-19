import { describe, expect, it } from 'vitest'
import {
  TimerActor,
  canControlTimer,
  canEmergencyStop,
  timerLockReason,
} from '@/lib/tasks/timerPermissions'
import type { WorkspaceTask } from '@/types/workspace'

type TimerTask = Pick<WorkspaceTask, 'assignedTo' | 'status'>

const task = (
  assignedTo: string | null,
  status: WorkspaceTask['status'] = 'queued',
): TimerTask => ({ assignedTo, status })

const member = (userId: string): TimerActor => ({
  userId,
  isPersonal: false,
  isOwner: false,
})
const owner = (userId: string): TimerActor => ({
  userId,
  isPersonal: false,
  isOwner: true,
})
const personal = (userId: string): TimerActor => ({
  userId,
  isPersonal: true,
  isOwner: true,
})

describe('canControlTimer', () => {
  it('lets the current assignee control the timer', () => {
    expect(canControlTimer(task('alice'), member('alice'))).toBe(true)
  })

  it('does not let another member control it', () => {
    expect(canControlTimer(task('alice'), member('bob'))).toBe(false)
  })

  it('does not let the workspace owner control someone else’s timer', () => {
    expect(canControlTimer(task('alice'), owner('olivia'))).toBe(false)
  })

  it('gives any member control of an unassigned task', () => {
    expect(canControlTimer(task(null), member('alice'))).toBe(true)
    expect(canControlTimer(task(null), owner('olivia'))).toBe(true)
  })

  it('moves control to the new assignee the moment the task is reassigned', () => {
    const before = task('alice', 'working')
    const after = { ...before, assignedTo: 'bob' }
    expect(canControlTimer(before, member('alice'))).toBe(true)
    expect(canControlTimer(before, member('bob'))).toBe(false)
    expect(canControlTimer(after, member('alice'))).toBe(false)
    expect(canControlTimer(after, member('bob'))).toBe(true)
  })

  it('denies everything without a signed-in user', () => {
    const anonymous = { userId: undefined, isPersonal: true, isOwner: false }
    expect(canControlTimer(task('alice'), anonymous)).toBe(false)
    expect(canControlTimer(task(null), anonymous)).toBe(false)
  })

  it('treats the sole member of a personal workspace as the assignee', () => {
    expect(canControlTimer(task(null), personal('me'))).toBe(true)
    expect(canControlTimer(task('me'), personal('me'))).toBe(true)
  })
})

describe('canEmergencyStop', () => {
  it('lets the owner stop another member’s running timer', () => {
    expect(canEmergencyStop(task('alice', 'working'), owner('olivia'))).toBe(
      true,
    )
  })

  it('is not needed on unassigned tasks because any member (including owner) can pause directly', () => {
    expect(canEmergencyStop(task(null, 'working'), owner('olivia'))).toBe(false)
  })

  it('does not apply when the timer is not running', () => {
    for (const status of [
      'queued',
      'paused',
      'completed',
      'skipped',
    ] as const) {
      expect(canEmergencyStop(task('alice', status), owner('olivia'))).toBe(
        false,
      )
    }
  })

  it('is not offered to ordinary members', () => {
    expect(canEmergencyStop(task('alice', 'working'), member('bob'))).toBe(
      false,
    )
  })

  it('is not offered to an owner who is the assignee — they just pause', () => {
    expect(canEmergencyStop(task('olivia', 'working'), owner('olivia'))).toBe(
      false,
    )
  })

  it('is never needed in a personal workspace', () => {
    expect(canEmergencyStop(task(null, 'working'), personal('me'))).toBe(false)
  })

  it('never doubles as permission to start someone else’s timer', () => {
    const running = task('alice', 'working')
    expect(canEmergencyStop(running, owner('olivia'))).toBe(true)
    expect(canControlTimer(running, owner('olivia'))).toBe(false)
  })
})

describe('timerLockReason', () => {
  it('has no reason when the actor controls the timer', () => {
    expect(timerLockReason(task('alice'), member('alice'))).toBeNull()
    expect(timerLockReason(task(null), personal('me'))).toBeNull()
    expect(timerLockReason(task(null), member('alice'))).toBeNull()
  })

  it('names the assignee rule when someone else holds the timer', () => {
    expect(timerLockReason(task('alice'), member('bob'))).toMatch(
      /only the assigned member/i,
    )
  })
})
