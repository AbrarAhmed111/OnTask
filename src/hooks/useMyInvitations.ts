'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AuthUser } from '@/hooks/useAuth'
import { InvitationStatus, WorkspaceInvitation } from '@/types/workspace'

// Shape returned by list_my_pending_invitations() — the workspace name and
// inviter's display name come pre-joined from Postgres, because an invitee
// can't read either row directly under RLS until they've actually joined.
type InvitationRow = {
  id: string
  workspace_id: string
  workspace_name: string | null
  invited_by: string
  inviter_name: string | null
  invited_email: string
  invited_user_id: string | null
  message: string | null
  status: InvitationStatus
  rejection_reason: string | null
  created_at: string
  responded_at: string | null
  expires_at: string
}

function rowToInvitation(row: InvitationRow): WorkspaceInvitation {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    workspaceName: row.workspace_name,
    invitedBy: row.invited_by,
    inviterName: row.inviter_name,
    invitedEmail: row.invited_email,
    invitedUserId: row.invited_user_id,
    message: row.message,
    status: row.status,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
    respondedAt: row.responded_at,
    expiresAt: row.expires_at,
  }
}

// Pending invitations addressed TO the current user — drives the invitation
// cards on /workspaces and the header's badge count. Recipient authorization
// is enforced in Postgres (list_my_pending_invitations matches on the
// caller's own user id/email; accept/reject re-check it), not here.
export function useMyInvitations(user: AuthUser | null) {
  const userId = user?.id
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!userId) {
      setInvitations([])
      setReady(true)
      return
    }
    let cancelled = false
    const supabase = createClient()
    supabase.rpc('list_my_pending_invitations').then(({ data }) => {
      if (cancelled) return
      setInvitations(((data ?? []) as InvitationRow[]).map(rowToInvitation))
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [userId])

  const respond = async (
    invitationId: string,
    action: 'accept' | 'reject',
    reason?: string,
  ) => {
    const supabase = createClient()
    const { data, error } =
      action === 'accept'
        ? await supabase.rpc('accept_workspace_invitation', {
            p_invitation_id: invitationId,
          })
        : await supabase.rpc('reject_workspace_invitation', {
            p_invitation_id: invitationId,
            p_reason: reason ?? null,
          })
    if (error) return { success: false as const, error: error.message }
    setInvitations(current => current.filter(inv => inv.id !== invitationId))
    return { success: true as const, invitation: data }
  }

  return { invitations, ready, respond }
}
