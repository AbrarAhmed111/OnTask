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
