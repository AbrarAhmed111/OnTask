'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AuthUser } from '@/hooks/useAuth'
import { InvitationStatus, WorkspaceInvitation } from '@/types/workspace'

type InvitationRow = {
  id: string
  workspace_id: string
  invited_by: string
  invited_email: string
  invited_user_id: string | null
  message: string | null
  status: InvitationStatus
  rejection_reason: string | null
  created_at: string
  responded_at: string | null
  expires_at: string
  workspaces: { name: string } | null
}

function rowToInvitation(row: InvitationRow): WorkspaceInvitation {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    workspaceName: row.workspaces?.name ?? null,
    invitedBy: row.invited_by,
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

// Pending invitations addressed TO the current user — drives both the
// Header nav badge count and the accept/reject list on /workspaces. Not
// email-delivered (no transactional email service is configured); this is
// the in-app surface the product spec calls for instead.
export function useMyInvitations(user: AuthUser | null) {
  const userId = user?.id
  const userEmail = user?.email
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
    let query = supabase
      .from('workspace_invitations')
      .select('*, workspaces(name)')
      .eq('status', 'pending')
    query = userEmail
      ? query.or(
          `invited_user_id.eq.${userId},invited_email.ilike.${userEmail}`,
        )
      : query.eq('invited_user_id', userId)
    query.then(({ data }) => {
      if (cancelled) return
      setInvitations(((data ?? []) as InvitationRow[]).map(rowToInvitation))
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [userId, userEmail])

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
