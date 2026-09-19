import { describe, expect, it } from 'vitest'
import {
  getDailyReportMetrics,
  hasReportActivity,
  narrativeParagraphs,
  reportTaskStatus,
} from './dailyReportMetrics'
import {
  EVO,
  abrar,
  blocker,
  rachel,
  sharedSnapshot,
  snapshot,
  task,
} from './dailyReportTestData'

// The report's figures come from the backend's snapshot, never from the AI's
// prose: durations, task counts, current status and the window stay
// authoritative whatever the narrative says.

describe('getDailyReportMetrics', () => {
  it('reports the focused time and completed tasks exactly as the snapshot computed them', () => {
    expect(getDailyReportMetrics(snapshot())).toEqual({
      focusedSeconds: 17280,
      tasksCompleted: 1,
      activeMembers: 1,
    })
  })

  it('trusts the snapshot metrics over anything derivable from the events', () => {
    // three completion EVENTS in the window, but the authoritative count is the
    // number of distinct tasks still completed at its end
    const snap = snapshot({
      workspace_changes: {
        invitations: [],
        members_joined: [],
        members_removed: [],
        tasks_created: 0,
        tasks_completed: 3,
        tasks_skipped: 0,
        tasks_deleted: 0,
      },
    })
    expect(getDailyReportMetrics(snap).tasksCompleted).toBe(1)
  })

  it('does not count a task completed, reopened and running again', () => {
    const snap = snapshot({
      metrics: { tasks_worked_on: 2, tasks_completed: 0 },
    })
    expect(getDailyReportMetrics(snap).tasksCompleted).toBe(0)
  })

  it('counts active members, for a shared workspace', () => {
    expect(getDailyReportMetrics(sharedSnapshot()).activeMembers).toBe(2)
    const idleMember = rachel({
      focused_seconds: 0,
      events: [],
      task_activity: [],
    })
    expect(
      getDailyReportMetrics(sharedSnapshot({ members: [abrar(), idleMember] }))
        .activeMembers,
    ).toBe(1)
  })

  it('derives the completed count for a snapshot from before metrics existed', () => {
    const legacy = snapshot()
    delete legacy.metrics
    expect(getDailyReportMetrics(legacy).tasksCompleted).toBe(1)
  })
})

describe('reportTaskStatus', () => {
  it('prefers the task’s state at the end of the period', () => {
    expect(
      reportTaskStatus(
        task({
          task_id: 't',
          title: EVO,
          status_end: 'completed',
          current_status: 'working',
        }),
      ),
    ).toBe('working')
  })

  it('falls back to the coarser status_end on an older snapshot', () => {
    expect(
      reportTaskStatus(
        task({ task_id: 't', title: EVO, status_end: 'skipped' }),
      ),
    ).toBe('skipped')
  })
})

describe('hasReportActivity', () => {
  it('is false only when nothing at all was recorded', () => {
    expect(
      hasReportActivity(snapshot({ total_focused_seconds: 0, members: [] })),
    ).toBe(false)
    expect(
      hasReportActivity(
        snapshot({
          total_focused_seconds: 0,
          members: [],
          blockers: [blocker()],
        }),
      ),
    ).toBe(true)
    expect(hasReportActivity(snapshot())).toBe(true)
  })
})

describe('narrativeParagraphs', () => {
  it('splits the narrative into the paragraphs it was written in', () => {
    expect(
      narrativeParagraphs({ overall_summary: 'One.\n\nTwo.\n\n\nThree.' }),
    ).toEqual(['One.', 'Two.', 'Three.'])
  })

  it('treats a report stored before this change as a single paragraph', () => {
    expect(narrativeParagraphs({ overall_summary: 'Only one.' })).toEqual([
      'Only one.',
    ])
    expect(narrativeParagraphs({ overall_summary: '  \n\n ' })).toEqual([])
  })
})
