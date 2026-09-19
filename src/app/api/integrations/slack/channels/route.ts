import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { listSlackChannels } from '@/lib/integrations/slack/slackClient'

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

  // Check workspace membership
  const { data: member } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single()

  if (!member) {
    return NextResponse.json(
      { error: 'Not a member of this workspace' },
      { status: 403 },
    )
  }

  const serviceClient = createServiceRoleClient()
  const { data: connection, error: connError } = await serviceClient
    .from('workspace_slack_connections')
    .select('bot_access_token')
    .eq('workspace_id', workspaceId)
    .single()

  if (connError || !connection) {
    return NextResponse.json(
      { error: 'No Slack workspace connected for this workspace.' },
      { status: 404 },
    )
  }

  try {
    const channels = await listSlackChannels(connection.bot_access_token)
    return NextResponse.json({ channels })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to fetch Slack channels'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
