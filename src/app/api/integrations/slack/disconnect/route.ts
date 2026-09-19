import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { workspaceId } = body

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Require Owner or Admin role
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (!member || !['owner', 'admin'].includes(member.role)) {
      return NextResponse.json(
        { error: 'Only workspace owners and admins can disconnect Slack.' },
        { status: 403 },
      )
    }

    const serviceClient = createServiceRoleClient()
    const { error: deleteError } = await serviceClient
      .from('workspace_slack_connections')
      .delete()
      .eq('workspace_id', workspaceId)

    if (deleteError) {
      console.error('[Slack Disconnect] Delete failed:', deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid request payload'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
