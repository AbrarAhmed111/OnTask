'use client'

import { createClient } from '@/lib/supabase/client'
import { decidePostLoginDestination, WORKSPACES_PATH } from '@/lib/auth/routing'

// Asks the database where a freshly signed-in user should land: first login
// with no invitations -> Personal Workspace, everyone else -> the workspace
// hub (see decidePostLoginDestination for the full rules). The state comes
// from Postgres (profiles.personal_welcome_seen_at + the user's pending
// invitations), never from the browser, so it holds across devices.
//
// Any failure falls back to the hub — it's always a safe place to land: it
// shows pending invitations and links to the Personal Workspace.
export async function resolvePostLoginDestination(): Promise<string> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc('get_post_login_state')
    if (error || !data) return WORKSPACES_PATH
    const row = (Array.isArray(data) ? data[0] : data) as
      | { personal_welcome_seen: boolean; pending_invitation_count: number }
      | undefined
    if (!row) return WORKSPACES_PATH
    return decidePostLoginDestination({
      personalWelcomeSeen: row.personal_welcome_seen,
      pendingInvitationCount: row.pending_invitation_count,
    })
  } catch {
    return WORKSPACES_PATH
  }
}
