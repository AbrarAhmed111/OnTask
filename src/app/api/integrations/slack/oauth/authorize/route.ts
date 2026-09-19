import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const workspaceId = searchParams.get('workspace_id')

  if (!workspaceId) {
    return NextResponse.json(
      { error: 'workspace_id is required' },
      { status: 400 },
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify caller is an Owner or Admin of the workspace
  const { data: member, error: memberError } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single()

  if (memberError || !member || !['owner', 'admin'].includes(member.role)) {
    return NextResponse.json(
      { error: 'Only workspace owners and admins can connect Slack.' },
      { status: 403 },
    )
  }

  const clientId = process.env.SLACK_CLIENT_ID
  if (!clientId) {
    return NextResponse.json(
      { error: 'SLACK_CLIENT_ID is not configured on the server.' },
      { status: 500 },
    )
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  const redirectUri = `${baseUrl}/api/integrations/slack/oauth/callback`

  // Build CSRF state containing user and workspace context
  const statePayload = {
    userId: user.id,
    workspaceId,
    timestamp: Date.now(),
  }
  const state = Buffer.from(JSON.stringify(statePayload)).toString('base64url')

  const scopes = ['chat:write', 'channels:read', 'groups:read'].join(',')
  const slackAuthUrl = `https://slack.com/oauth/v2/authorize?client_id=${encodeURIComponent(
    clientId,
  )}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(
    redirectUri,
  )}&state=${encodeURIComponent(state)}`

  return NextResponse.redirect(slackAuthUrl)
}
