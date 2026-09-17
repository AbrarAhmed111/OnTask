import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendMail } from '@/lib/email/mailer'
import { buildInvitationEmail } from '@/lib/email/templates/invitationEmail'

// Sends the invitation notification email. The DB insert (done client-side,
// RLS-protected to workspace owners) is the source of truth for the
// invitation itself — this route only re-reads that same row server-side
// and treats it as authoritative, rather than trusting any workspace/inviter
// details the client might pass directly, so this endpoint can't be used to
// blast arbitrary email content through the app's SMTP account.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const invitationId = body?.invitationId
  if (!invitationId || typeof invitationId !== 'string') {
    return NextResponse.json({ error: 'Missing invitationId' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: invitation, error: invitationError } = await supabase
    .from('workspace_invitations')
    .select('invited_email, invited_by, message, workspace_id')
    .eq('id', invitationId)
    .single()

  if (invitationError || !invitation) {
    return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
  }
  if (invitation.invited_by !== user.id) {
    return NextResponse.json(
      { error: 'Not authorized to send this invitation' },
      { status: 403 },
    )
  }

  const [{ data: workspace }, { data: inviterProfile }] = await Promise.all([
    supabase
      .from('workspaces')
      .select('name')
      .eq('id', invitation.workspace_id)
      .single(),
    supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single(),
  ])

  const workspaceName = workspace?.name ?? 'a workspace'
  const inviterName =
    inviterProfile?.full_name || inviterProfile?.email || 'A teammate'
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

  // Carries the invitation id + workspace name + invited address through to
  // the client so a recipient with no session yet lands on a contextual
  // "log in to join <workspace>" prompt (see useAuthGuard/Dashboard.tsx/
  // workspaces/page.tsx), and — just as importantly — so a visitor who's
  // already signed in as a *different* account can be told exactly that,
  // rather than being shown a generic "invitation not found" for an
  // invitation their session's RLS grant simply can't see. The email
  // address isn't sensitive here: it's the same address this link was just
  // emailed to.
  const acceptUrl = `${baseUrl}/workspaces?${new URLSearchParams({
    invite: invitationId,
    workspace: workspaceName,
    email: invitation.invited_email,
  }).toString()}`

  const { subject, html, text } = buildInvitationEmail({
    workspaceName,
    inviterName,
    message: invitation.message,
    invitedEmail: invitation.invited_email,
    acceptUrl,
  })

  try {
    await sendMail({ to: invitation.invited_email, subject, html, text })
  } catch (err) {
    console.error('Failed to send invitation email:', err)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 502 })
  }

  return NextResponse.json({ success: true })
}
