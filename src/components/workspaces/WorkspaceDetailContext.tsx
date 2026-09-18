'use client'

import { createContext, useContext } from 'react'
import type { AuthUser } from '@/hooks/useAuth'
import type { useWorkspace } from '@/hooks/useWorkspace'
import type { useWorkspaceInvitations } from '@/hooks/useWorkspaceInvitations'
import type {
  Workspace,
  WorkspaceMember,
  WorkspaceRole,
} from '@/types/workspace'

// Shared, layout-level workspace state (workspace/members/role/invitations/
// presence) that every nested page (overview, members, settings) needs —
// fetched once in the layout so switching between them doesn't re-fetch it.
export type WorkspaceDetailContextValue = {
  workspaceId: string
  user: AuthUser
  workspace: Workspace | null
  members: WorkspaceMember[]
  role: WorkspaceRole | null
  isOwner: boolean
  ready: boolean
  error: string | null
  updateWorkspace: ReturnType<typeof useWorkspace>['updateWorkspace']
  removeMember: ReturnType<typeof useWorkspace>['removeMember']
  onlineUserIds: Set<string>
  invitations: ReturnType<typeof useWorkspaceInvitations>['invitations']
  invitationsReady: boolean
  inviteByEmail: ReturnType<typeof useWorkspaceInvitations>['inviteByEmail']
  cancelInvitation: ReturnType<
    typeof useWorkspaceInvitations
  >['cancelInvitation']
  deleteInvitation: ReturnType<
    typeof useWorkspaceInvitations
  >['deleteInvitation']
  openInvite: () => void
  onLogout: () => void
}

export const WorkspaceDetailContext =
  createContext<WorkspaceDetailContextValue | null>(null)

export function useWorkspaceDetail() {
  const ctx = useContext(WorkspaceDetailContext)
  if (!ctx) {
    throw new Error(
      'useWorkspaceDetail must be used within the workspace detail layout',
    )
  }
  return ctx
}
