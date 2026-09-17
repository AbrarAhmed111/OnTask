export type WorkspaceRole = 'owner' | 'member'

export type Workspace = {
  id: string
  name: string
  description: string | null
  ownerId: string
  timezone: string
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

// ── Phase 10: Shared AI "Yesterday's Work" Summary ──────────────────────────
// structured_snapshot/narrative/meta are stored (and returned by ontask-llm)
// as-is, snake_case, matching that service's Pydantic schema field names
// exactly — only the outer row columns get the usual camelCase treatment.
// See ontask-llm/src/app/schemas/summary.py for the authoritative shape.

export type SummaryTaskStatus = 'completed' | 'in_progress' | 'skipped'

export type StructuredSnapshotTask = {
  task_id: string
  name: string
  parent_task_id: string | null
  status: SummaryTaskStatus
  focused_seconds: number
}

export type StructuredSnapshotMember = {
  user_id: string
  display_name: string
  focused_seconds: number
  tasks: StructuredSnapshotTask[]
}

export type WorkspaceStructuredSnapshot = {
  workspace_id: string
  workspace_name: string
  summary_date: string
  timezone: string
  total_focused_seconds: number
  members: StructuredSnapshotMember[]
}

export type SummaryMemberNote = {
  user_id: string
  note: string
}

export type SummaryNarrative = {
  overall_summary: string
  member_notes: SummaryMemberNote[]
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

export type WorkspaceDailySummary = {
  id: string
  workspaceId: string
  summaryDate: string
  version: number
  structuredSnapshot: WorkspaceStructuredSnapshot
  narrative: SummaryNarrative
  meta: SummaryGenerationMeta
  generatedBy: string
  generatedAt: string
  createdAt: string
}
