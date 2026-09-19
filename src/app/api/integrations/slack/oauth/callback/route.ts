import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { exchangeOAuthCode } from '@/lib/integrations/slack/slackClient'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const slackError = searchParams.get('error')

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

  if (slackError) {
    console.error(
      '[Slack OAuth] Access denied or error returned from Slack:',
      slackError,
    )
    return NextResponse.redirect(`${baseUrl}/?error=slack_auth_denied`)
  }

  if (!code || !state) {
    return NextResponse.json(
      { error: 'Missing code or state' },
      { status: 400 },
    )
  }

  let statePayload: { userId: string; workspaceId: string; timestamp: number }
  try {
    statePayload = JSON.parse(Buffer.from(state, 'base64url').toString('utf-8'))
  } catch {
    return NextResponse.json(
      { error: 'Invalid state parameter' },
      { status: 400 },
    )
  }

  // Validate state timestamp (15 minute expiration)
  if (Date.now() - statePayload.timestamp > 15 * 60 * 1000) {
    return NextResponse.json(
      { error: 'OAuth state has expired' },
      { status: 400 },
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || user.id !== statePayload.userId) {
    return NextResponse.json(
      { error: 'Unauthorized user match' },
      { status: 401 },
    )
  }

  // Fetch workspace details to get slug for redirect
  const { data: workspace, error: wsError } = await supabase
    .from('workspaces')
    .select('id, slug, name')
    .eq('id', statePayload.workspaceId)
    .single()

  if (wsError || !workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  }

  // Exchange OAuth code with Slack API
  const redirectUri = `${baseUrl}/api/integrations/slack/oauth/callback`
  try {
    const oauthResult = await exchangeOAuthCode(code, redirectUri)

    if (!oauthResult.ok || !oauthResult.access_token || !oauthResult.team) {
      console.error('[Slack OAuth] Token exchange failed:', oauthResult.error)
      return NextResponse.redirect(
        `${baseUrl}/workspaces/${workspace.slug}?slack_error=${encodeURIComponent(
          oauthResult.error || 'token_exchange_failed',
        )}`,
      )
    }

    // Persist Slack connection with service role client
    const serviceRoleClient = createServiceRoleClient()
    const { error: upsertError } = await serviceRoleClient
      .from('workspace_slack_connections')
      .upsert(
        {
          workspace_id: workspace.id,
          slack_team_id: oauthResult.team.id,
          slack_team_name: oauthResult.team.name,
          bot_access_token: oauthResult.access_token,
          bot_user_id: oauthResult.bot_user_id ?? null,
          connected_by: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'workspace_id' },
      )

    if (upsertError) {
      console.error('[Slack OAuth] Database upsert failed:', upsertError)
      return NextResponse.redirect(
        `${baseUrl}/workspaces/${workspace.slug}?slack_error=db_save_failed`,
      )
    }

    return NextResponse.redirect(
      `${baseUrl}/workspaces/${workspace.slug}?slack=connected`,
    )
  } catch (err) {
    console.error('[Slack OAuth] Unexpected error during callback:', err)
    return NextResponse.redirect(
      `${baseUrl}/workspaces/${workspace.slug}?slack_error=unexpected_error`,
    )
  }
}
