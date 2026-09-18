import { describe, expect, it } from 'vitest'
import {
  buildFallbackNarrative,
  buildUnreachableFallbackMeta,
} from './dailyReportFallback'
import { WorkspaceStructuredSnapshot } from '@/types/workspace'

// Abrar: 3h 0m (10800s), Rachel: 1h 49m (6540s), total 4h 49m (17340s) -- the
// exact scenario from the reported bug, used here to verify the deterministic
// TS-side fallback (used when ontask-llm itself is unreachable) never
// disagrees with the backend's own numbers.
function snapshot(
  overrides: Partial<WorkspaceStructuredSnapshot> = {},
): WorkspaceStructuredSnapshot {
  return {
    workspace_id: 'ws-1',
    workspace_name: 'Design Team',
    report_start: '2026-09-17T14:45:00Z',
    report_end: '2026-09-18T14:45:00Z',
    timezone: 'Asia/Karachi',
    total_focused_seconds: 17340,
    members: [
      {
        user_id: 'abrar',
        display_name: 'Abrar Ahmed',
        focused_seconds: 10800,
        events: [],
        task_activity: [
          {
            task_id: 'task-1',
            title: 'Research and Learn',
            parent_task_id: null,
            parent_title: null,
            goal_id: null,
            goal_name: null,
            focused_seconds: 10800,
            progress_start: null,
            progress_end: null,
            status_end: 'completed',
          },
        ],
      },
      {
        user_id: 'rachel',
        display_name: 'Rachel Smith',
        focused_seconds: 6540,
        events: [],
        task_activity: [
          {
            task_id: 'task-2',
            title: 'First Module: Design The Architect',
            parent_task_id: null,
            parent_title: null,
            goal_id: null,
            goal_name: null,
            focused_seconds: 6540,
            progress_start: null,
            progress_end: null,
            status_end: 'in_progress',
          },
        ],
      },
    ],
    workspace_changes: {
      invitations: [],
      members_joined: [],
      members_removed: [],
      tasks_created: 0,
      tasks_completed: 0,
      tasks_skipped: 0,
      tasks_deleted: 0,
    },
    ...overrides,
  }
}

describe('buildFallbackNarrative', () => {
  it('never states a total that disagrees with total_focused_seconds', () => {
    const narrative = buildFallbackNarrative(snapshot())
    expect(narrative.overall_summary).toContain('4h 49m')
    expect(narrative.members.find(m => m.user_id === 'abrar')?.note).toContain(
      '3h 0m',
    )
    expect(narrative.members.find(m => m.user_id === 'rachel')?.note).toContain(
      '1h 49m',
    )
  })

  it('counts completed tasks per member correctly', () => {
    const narrative = buildFallbackNarrative(snapshot())
    expect(narrative.members.find(m => m.user_id === 'abrar')?.note).toContain(
      '1 completed',
    )
    expect(narrative.members.find(m => m.user_id === 'rachel')?.note).toContain(
      '0 completed',
    )
  })

  it('produces the no-activity sentence when nothing happened', () => {
    const narrative = buildFallbackNarrative(
      snapshot({
        total_focused_seconds: 0,
        members: [],
      }),
    )
    expect(narrative.overall_summary).toBe(
      'No significant workspace activity was recorded during the previous 24 hours.',
    )
    expect(narrative.members).toEqual([])
  })

  it('still reports on an invitation-only window with zero focused time', () => {
    const narrative = buildFallbackNarrative(
      snapshot({
        total_focused_seconds: 0,
        members: [],
        workspace_changes: {
          invitations: [
            {
              invited_email: 'ali@example.com',
              invited_by_user_id: 'abrar',
              invited_by_name: 'Abrar Ahmed',
              status: 'pending',
              responded_at: null,
            },
          ],
          members_joined: [],
          members_removed: [],
          tasks_created: 0,
          tasks_completed: 0,
          tasks_skipped: 0,
          tasks_deleted: 0,
        },
      }),
    )
    expect(narrative.overall_summary).not.toContain(
      'No significant workspace activity',
    )
    expect(narrative.workspace_changes_summary).toContain(
      '1 invitation(s) sent or updated',
    )
  })
})

describe('buildFallbackNarrative with task blockers', () => {
  const blocker = {
    blocker_id: 'b-1',
    task_id: 'task-1',
    task_title: 'Student API',
    parent_title: null,
    goal_id: null,
    goal_name: null,
    reason: 'Waiting for API credentials from Araysh.',
    blocked_by_user_id: 'abrar',
    blocked_by_name: 'Abrar Ahmed',
    blocked_at: '2026-09-18T09:00:00Z',
    mentioned: [{ user_id: 'araysh', display_name: 'Araysh' }],
    resolved_at: null,
    resolved_by_user_id: null,
    resolved_by_name: null,
    resolution_note: null,
    still_blocked_at_report_end: true,
    blocked_seconds: 7200,
  }

  it('treats a blockers-only window as activity, not an idle one', () => {
    const narrative = buildFallbackNarrative(
      snapshot({
        total_focused_seconds: 0,
        members: [],
        blockers: [blocker],
      }),
    )
    expect(narrative.overall_summary).not.toContain(
      'No significant workspace activity',
    )
    expect(narrative.workspace_changes_summary).toContain(
      '1 task blocker(s) recorded',
    )
  })

  it('mentions blockers alongside the other workspace changes', () => {
    const narrative = buildFallbackNarrative(
      snapshot({ blockers: [blocker, { ...blocker, blocker_id: 'b-2' }] }),
    )
    expect(narrative.workspace_changes_summary).toContain(
      '2 task blocker(s) recorded',
    )
  })

  it('leaves reports from before blockers existed exactly as they were', () => {
    // No `blockers` key at all, as on a stored pre-feature snapshot.
    const narrative = buildFallbackNarrative(snapshot())
    expect(narrative.workspace_changes_summary).toBe('')
  })
})

describe('buildUnreachableFallbackMeta', () => {
  it('flags the report as a fallback with the failure reason recorded', () => {
    const meta = buildUnreachableFallbackMeta('fetch failed: ECONNREFUSED')
    expect(meta.used_fallback_template).toBe(true)
    expect(meta.provider).toBe('none')
    expect(meta.validation_warnings[0]).toContain('ECONNREFUSED')
  })
})
