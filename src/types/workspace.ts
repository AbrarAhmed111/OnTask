export type WorkspaceRole = 'owner' | 'member'

export type Workspace = {
  id: string
  name: string
  description: string | null
  ownerId: string
  timezone: string
  // The workspace-local time of day (e.g. "12:00:00") the automatic Daily
  // Report is generated at -- owner-configurable, defaults to noon.
  reportTime: string
  accent: string
  createdAt: string
  updatedAt: string
}

export type WorkspaceMember = {
  id: string
  workspaceId: string
  userId: string
  role: WorkspaceRole
  joinedAt: string
  fullName: string | null
  email: string | null
  avatarUrl: string | null
}

export type InvitationStatus =
  'pending' | 'accepted' | 'rejected' | 'expired' | 'cancelled'

export type WorkspaceInvitation = {
  id: string
  workspaceId: string
  workspaceName: string | null
  invitedBy: string
  invitedEmail: string
  invitedUserId: string | null
  message: string | null
  status: InvitationStatus
  rejectionReason: string | null
  createdAt: string
  respondedAt: string | null
  expiresAt: string
}

export type WorkspaceTaskStatus =
  'queued' | 'working' | 'paused' | 'completed' | 'skipped'

export type WorkspaceTask = {
  id: string
  workspaceId: string
  parentTaskId: string | null
  createdBy: string
  assignedTo: string | null
  name: string
  plannedMinutes: number
  workedSeconds: number
  status: WorkspaceTaskStatus
  goalName?: string
  goalProgress?: number
  startedAt: number | null
  completedAt: number | null
}

// ── Phase 11: Automatic Daily Report (rolling 24h, workspace-timezone noon) ─
// structured_snapshot/narrative/meta are stored (and returned by ontask-llm)
// as-is, snake_case, matching that service's Pydantic schema field names
// exactly — only the outer row columns get the usual camelCase treatment.
// See ontask-llm/src/app/schemas/summary.py for the authoritative shape, and
// supabase/migrations/0018_automatic_daily_reports.sql for how it's actually
// assembled and scheduled.

export type SummaryTaskStatus = 'completed' | 'in_progress' | 'skipped'

// One task_events row (or a synthesized 'invitation_sent' entry attributed
// to the inviter) — the raw, factual activity log a member's narrative is
// grounded in. `metadata` is forwarded from the DB as-is; shape depends on
// `type` (from/to for assignment or progress changes, invited_email/status
// for invitations, ...).
export type StructuredSnapshotEvent = {
  type: string
  timestamp: string
  task_id: string | null
  task_title: string | null
  parent_title: string | null
  metadata: Record<string, unknown>
}

export type StructuredSnapshotTaskActivity = {
  task_id: string
  title: string
  parent_task_id: string | null
  parent_title: string | null
  focused_seconds: number
  // Only set when a progress_changed event occurred that day — never
  // inferred from the task's current value.
  progress_start: number | null
  progress_end: number | null
  status_end: SummaryTaskStatus
}

export type StructuredSnapshotMember = {
  user_id: string
  display_name: string
  focused_seconds: number
  events: StructuredSnapshotEvent[]
  task_activity: StructuredSnapshotTaskActivity[]
}

export type StructuredSnapshotInvitation = {
  invited_email: string
  invited_by_user_id: string
  invited_by_name: string
  status: string
  responded_at: string | null
}

export type StructuredSnapshotMemberChange = {
  user_id: string
  display_name: string
}

export type StructuredSnapshotWorkspaceChanges = {
  invitations: StructuredSnapshotInvitation[]
  members_joined: StructuredSnapshotMemberChange[]
  members_removed: StructuredSnapshotMemberChange[]
  tasks_created: number
  tasks_completed: number
  tasks_skipped: number
  tasks_deleted: number
}

export type WorkspaceStructuredSnapshot = {
  workspace_id: string
  workspace_name: string
  report_start: string
  report_end: string
  timezone: string
  total_focused_seconds: number
  members: StructuredSnapshotMember[]
  workspace_changes: StructuredSnapshotWorkspaceChanges
}

export type SummaryMemberNarrative = {
  user_id: string
  note: string
}

export type SummaryNarrative = {
  overall_summary: string
  members: SummaryMemberNarrative[]
  workspace_changes_summary: string
  highlights: string[]
}

export type SummaryProviderStatusEvent = {
  type: string
  status: string
  message: string
  provider: string
}

export type SummaryGenerationMeta = {
  provider: string
  model: string
  generated_at: string
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  status_events: SummaryProviderStatusEvent[]
  used_fallback_template: boolean
  validation_warnings: string[]
}

export type DailyReportGenerationType = 'automatic' | 'manual'
export type DailyReportGenerationStatus = 'pending' | 'completed' | 'failed'

export type WorkspaceDailySummary = {
  id: string
  workspaceId: string
  reportStart: string
  reportEnd: string
  reportTimezone: string
  version: number
  structuredSnapshot: WorkspaceStructuredSnapshot
  narrative: SummaryNarrative
  meta: SummaryGenerationMeta
  generationType: DailyReportGenerationType
  generationStatus: DailyReportGenerationStatus
  generatedBy: string | null
  generatedAt: string
  regeneratedBy: string | null
  regeneratedAt: string | null
  createdAt: string
}
