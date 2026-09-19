import {
  StructuredSnapshotBlocker,
  StructuredSnapshotEvent,
  StructuredSnapshotMember,
  StructuredSnapshotTaskActivity,
  WorkspaceDailySummary,
  WorkspaceStructuredSnapshot,
} from '@/types/workspace'

// Fixtures for the Daily Report tests -- the scenario the redesign was written
// around (project_document/ai-report-update.md), and the same one
// ontask-llm/tests/factories.py uses, so the two deterministic fallbacks are
// asserted against identical strings: Abrar Ahmed spends the period on "Working
// on OnTask Evolution" (resumed several times, completed, reopened, completed
// again) and on "Finishing Chapters of 2nd Book" (resumed and paused).
// 4h 48m focused in total, over 2 tasks.
export const EVO = 'Working on OnTask Evolution'
export const BOOK = 'Finishing Chapters of 2nd Book'
export const ABRAR = 'user-abrar'
export const RACHEL = 'user-rachel'

export function event(
  type: string,
  minute: number,
  overrides: Partial<StructuredSnapshotEvent> = {},
): StructuredSnapshotEvent {
  const hour = String(12 + Math.floor(minute / 60)).padStart(2, '0')
  const min = String(minute % 60).padStart(2, '0')
  return {
    type,
    timestamp: `2026-09-18T${hour}:${min}:00Z`,
    task_id: 'task-evo',
    task_title: EVO,
    parent_title: null,
    actor_user_id: ABRAR,
    actor_name: 'Abrar Ahmed',
    metadata: {},
    ...overrides,
  }
}

export function task(
  overrides: Partial<StructuredSnapshotTaskActivity> & {
    task_id: string
    title: string
  },
): StructuredSnapshotTaskActivity {
  return {
    parent_task_id: null,
    parent_title: null,
    goal_id: null,
    goal_name: null,
    focused_seconds: 0,
    progress_start: null,
    progress_end: null,
    status_end: 'in_progress',
    ...overrides,
  }
}

export function abrar(
  overrides: Partial<StructuredSnapshotMember> = {},
): StructuredSnapshotMember {
  return {
    user_id: ABRAR,
    display_name: 'Abrar Ahmed',
    focused_seconds: 17280, // 4h 48m
    events: [
      event('created', 0),
      event('resumed', 5),
      event('paused', 15),
      event('resumed', 25),
      event('completed', 60),
      event('reopened', 90),
      event('resumed', 100),
      event('completed', 140),
      event('resumed', 150, { task_id: 'task-book', task_title: BOOK }),
      event('paused', 170, { task_id: 'task-book', task_title: BOOK }),
    ],
    task_activity: [
      task({
        task_id: 'task-evo',
        title: EVO,
        focused_seconds: 10800,
        status_end: 'completed',
        current_status: 'completed',
      }),
      task({
        task_id: 'task-book',
        title: BOOK,
        focused_seconds: 6480,
        current_status: 'paused',
      }),
    ],
    ...overrides,
  }
}

export function rachel(
  overrides: Partial<StructuredSnapshotMember> = {},
): StructuredSnapshotMember {
  return {
    user_id: RACHEL,
    display_name: 'Rachel Smith',
    focused_seconds: 3600,
    events: [
      event('started', 30, {
        task_id: 'task-onboarding',
        task_title: 'Onboarding flow',
        actor_user_id: RACHEL,
        actor_name: 'Rachel Smith',
      }),
    ],
    task_activity: [
      task({
        task_id: 'task-onboarding',
        title: 'Onboarding flow',
        focused_seconds: 3600,
        current_status: 'working',
      }),
    ],
    ...overrides,
  }
}

export function snapshot(
  overrides: Partial<WorkspaceStructuredSnapshot> = {},
): WorkspaceStructuredSnapshot {
  const members = overrides.members ?? [abrar()]
  return {
    workspace_id: 'ws-1',
    workspace_name: 'Personal Workspace',
    workspace_type: 'personal',
    report_start: '2026-09-18T12:00:00Z',
    report_end: '2026-09-19T12:00:00Z',
    timezone: 'UTC',
    total_focused_seconds: members.reduce(
      (sum, m) => sum + m.focused_seconds,
      0,
    ),
    metrics: { tasks_worked_on: 2, tasks_completed: 1 },
    members,
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

export function sharedSnapshot(
  overrides: Partial<WorkspaceStructuredSnapshot> = {},
): WorkspaceStructuredSnapshot {
  return snapshot({
    workspace_name: 'Design Team',
    workspace_type: 'shared',
    members: [abrar(), rachel()],
    ...overrides,
  })
}

export function blocker(
  overrides: Partial<StructuredSnapshotBlocker> = {},
): StructuredSnapshotBlocker {
  return {
    blocker_id: 'b-1',
    task_id: 'task-1',
    task_title: 'Student API',
    parent_title: null,
    goal_id: null,
    goal_name: null,
    reason: 'Waiting for API credentials from Araysh.',
    blocked_by_user_id: ABRAR,
    blocked_by_name: 'Abrar Ahmed',
    blocked_at: '2026-09-18T13:00:00Z',
    mentioned: [{ user_id: 'user-araysh', display_name: 'Araysh Khan' }],
    resolved_at: '2026-09-18T15:00:00Z',
    resolved_by_user_id: 'user-araysh',
    resolved_by_name: 'Araysh Khan',
    resolution_note: 'API credentials have been provided.',
    still_blocked_at_report_end: false,
    blocked_seconds: 7200,
    ...overrides,
  }
}

export function summary(
  snap: WorkspaceStructuredSnapshot,
  narrativeText: string,
  overrides: Partial<WorkspaceDailySummary> = {},
): WorkspaceDailySummary {
  return {
    id: 'sum-1',
    workspaceId: 'ws-1',
    reportStart: snap.report_start,
    reportEnd: snap.report_end,
    reportTimezone: 'UTC',
    version: 1,
    structuredSnapshot: snap,
    narrative: {
      overall_summary: narrativeText,
      members: [],
      workspace_changes_summary: '',
      highlights: [],
    },
    meta: {
      provider: 'Gemini',
      model: 'gemini-2.5-flash-lite',
      generated_at: '2026-09-19T12:00:05Z',
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      status_events: [],
      used_fallback_template: false,
      validation_warnings: [],
    },
    generationType: 'automatic',
    generationStatus: 'completed',
    generatedBy: null,
    generatedAt: '2026-09-19T12:00:05Z',
    regeneratedBy: null,
    regeneratedAt: null,
    createdAt: '2026-09-19T12:00:00Z',
    ...overrides,
  }
}
