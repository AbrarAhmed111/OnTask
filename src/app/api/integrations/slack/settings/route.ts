import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { workspaceId, channelId, channelName, notificationSettings } = body

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspaceId is required' },
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

    // Require Owner or Admin role to update Slack settings
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (!member || !['owner', 'admin'].includes(member.role)) {
      return NextResponse.json(
        {
          error: 'Only workspace owners and admins can modify Slack settings.',
        },
        { status: 403 },
      )
    }

    const serviceClient = createServiceRoleClient()

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (channelId !== undefined) updatePayload.channel_id = channelId
    if (channelName !== undefined) updatePayload.channel_name = channelName
    if (notificationSettings !== undefined)
      updatePayload.notification_settings = notificationSettings

    const { data: updated, error: updateError } = await serviceClient
      .from('workspace_slack_connections')
      .update(updatePayload)
      .eq('workspace_id', workspaceId)
      .select(
        'id, workspace_id, slack_team_name, channel_id, channel_name, notification_settings',
      )
      .single()

    if (updateError) {
      console.error('[Slack Settings] Update failed:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, connection: updated })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Invalid request payload'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
