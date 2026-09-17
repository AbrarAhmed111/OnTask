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
}

function rowToInvitation(row: InvitationRow): WorkspaceInvitation {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    workspaceName: null,
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

// Invitations sent FOR a given workspace — the owner's view (who's been
// invited, and their status/rejection reason once they respond).
export function useWorkspaceInvitations(
  workspaceId: string,
  user: AuthUser | null,
) {
  const userId = user?.id
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId || !workspaceId) {
      setReady(true)
      return
    }
    let cancelled = false
    setReady(false)
    const supabase = createClient()
    supabase
      .from('workspace_invitations')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .then(({ data, error: fetchError }) => {
        if (cancelled) return
        if (fetchError) {
          setError("Couldn't load invitations.")
          setReady(true)
          return
        }
        setInvitations(((data ?? []) as InvitationRow[]).map(rowToInvitation))
        setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [userId, workspaceId])

  const inviteByEmail = async (email: string, message: string) => {
    if (!userId) return { success: false as const, error: 'Not signed in.' }
    const normalized = email.trim().toLowerCase()
    if (
      invitations.some(
        inv =>
          inv.status === 'pending' &&
          inv.invitedEmail.toLowerCase() === normalized,
      )
    ) {
      return {
        success: false as const,
        error: 'There is already a pending invitation for this email.',
      }
    }
    const supabase = createClient()
    const { data, error: insertError } = await supabase
      .from('workspace_invitations')
      .insert({
        workspace_id: workspaceId,
        invited_by: userId,
        invited_email: normalized,
        message: message.trim() || null,
      })
      .select('*')
      .single()
    if (insertError || !data) {
      return {
        success: false as const,
        error: insertError?.message ?? 'Failed to send invitation.',
      }
    }
    const invitation = rowToInvitation(data as InvitationRow)
    setInvitations(current => [invitation, ...current])
    // The invitation record itself is already created and surfaces in-app
    // regardless of what happens next, so a failed email doesn't fail this
    // whole call — but it IS awaited, so the caller can tell the user
    // truthfully whether the email actually went out.
    const emailSent = await fetch('/api/workspace-invitations/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invitationId: invitation.id }),
    })
      .then(res => res.ok)
      .catch(() => false)
    return { success: true as const, emailSent }
  }

  const cancelInvitation = async (invitationId: string) => {
    const supabase = createClient()
    const { error: updateError } = await supabase
      .from('workspace_invitations')
      .update({ status: 'cancelled' })
      .eq('id', invitationId)
    if (updateError) {
      return { success: false as const, error: updateError.message }
    }
    setInvitations(current =>
      current.map(inv =>
        inv.id === invitationId ? { ...inv, status: 'cancelled' } : inv,
      ),
    )
    return { success: true as const }
  }

  // Clears invitation history (cancelled/rejected/expired) — RLS (0012)
  // rejects this for a still-'pending' row, so cancelling one always goes
  // through cancelInvitation above instead of straight to delete.
  const deleteInvitation = async (invitationId: string) => {
    const supabase = createClient()
    const { error: deleteError } = await supabase
      .from('workspace_invitations')
      .delete()
      .eq('id', invitationId)
    if (deleteError) {
      return { success: false as const, error: deleteError.message }
    }
    setInvitations(current => current.filter(inv => inv.id !== invitationId))
    return { success: true as const }
  }

  return {
    invitations,
    ready,
    error,
    inviteByEmail,
    cancelInvitation,
    deleteInvitation,
  }
}
