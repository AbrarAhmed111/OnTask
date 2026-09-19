/**
 * Asynchronous Slack Event Dispatcher for OnTask.
 * Fetches workspace connection settings, builds Block Kit messages, and posts to Slack safely.
 */

import { createServiceRoleClient } from '@/lib/supabase/service'
import { postSlackMessage } from './slackClient'
import { buildSlackEventMessage } from './slackMessageBuilder'

export interface DispatchSlackEventParams {
  workspaceId: string
  eventType: string
  eventId?: string
  taskId?: string
  taskTitle?: string
  actorId?: string
  recipientUserId?: string
  blockerReason?: string
  reportId?: string
}

export async function dispatchSlackNotification(
  params: DispatchSlackEventParams,
): Promise<{ success: boolean; outcome: string; error?: string }> {
  try {
    const { workspaceId, eventType, eventId, taskId, taskTitle, actorId, recipientUserId, blockerReason, reportId } = params

    if (!workspaceId || !eventType) {
      return { success: false, outcome: 'invalid_params' }
    }

    const supabase = createServiceRoleClient()
    if (typeof supabase?.from !== 'function') {
      return { success: false, outcome: 'client_not_supported' }
    }

    // 1. Idempotency Check (Phase 11): Prevent duplicate notifications for same event_id
    if (eventId) {
      const { error: idempotencyError } = await supabase
        .from('workspace_slack_deliveries')
        .insert({
          workspace_id: workspaceId,
          event_id: eventId,
          event_type: eventType,
        })

      if (idempotencyError && idempotencyError.code === '23505') {
        // Unique violation (already delivered)
        return { success: true, outcome: 'duplicate_event_skipped' }
      }
    }

    // 2. Fetch Slack connection for workspace
    const { data: connection, error: connError } = await supabase
      .from('workspace_slack_connections')
      .select('*')
      .eq('workspace_id', workspaceId)
      .single()

    if (connError || !connection || !connection.bot_access_token || !connection.channel_id) {
      return { success: true, outcome: 'no_channel_configured' }
    }

    // 3. Check notification preferences
    const settings = connection.notification_settings || {}
    let isEnabled = true

    if (eventType === 'assigned' || eventType === 'reassigned') {
      isEnabled = settings.assigned !== false
    } else if (eventType === 'completed' || eventType === 'reopened') {
      isEnabled = settings.completed !== false
    } else if (eventType === 'blocker_created') {
      isEnabled = settings.blockers !== false
    } else if (eventType === 'blocker_resolved' || eventType === 'task_unblocked') {
      isEnabled = settings.resolutions !== false
    } else if (eventType === 'daily_report_ready') {
      isEnabled = settings.daily_reports !== false
    }

    if (!isEnabled) {
      return { success: true, outcome: 'notification_type_disabled' }
    }

    // 4. Fetch workspace slug & name
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('name, slug')
      .eq('id', workspaceId)
      .single()

    if (!workspace) {
      return { success: false, outcome: 'workspace_not_found' }
    }

    // 5. Fetch display names for actor & recipient
    let actorName = 'Someone'
    if (actorId) {
      const { data: actorProfile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', actorId)
        .single()
      if (actorProfile) {
        actorName = actorProfile.full_name || actorProfile.email?.split('@')[0] || 'Someone'
      }
    }

    let recipientName: string | undefined
    if (recipientUserId) {
      const { data: recipientProfile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', recipientUserId)
        .single()
      if (recipientProfile) {
        recipientName = recipientProfile.full_name || recipientProfile.email?.split('@')[0]
      }
    }

    // 6. Build message payload
    const messagePayload = buildSlackEventMessage({
      workspaceName: workspace.name,
      workspaceSlug: workspace.slug,
      eventType,
      taskTitle,
      taskId,
      actorName,
      recipientName,
      blockerReason,
      reportId,
    })

    // 7. Post message to Slack
    const postResult = await postSlackMessage(
      connection.bot_access_token,
      connection.channel_id,
      messagePayload.fallbackText,
      messagePayload.blocks,
    )

    if (!postResult.ok) {
      console.error('[Slack Dispatcher] Slack postMessage failed:', postResult.error)
      const errCode = postResult.error || ''

      // Phase 14: Update integration health state based on API error code
      if (['token_revoked', 'account_inactive', 'invalid_auth'].includes(errCode)) {
        await supabase
          .from('workspace_slack_connections')
          .update({ connection_status: 'invalid_token' })
          .eq('id', connection.id)
      } else if (['channel_not_found', 'is_archived', 'not_in_channel'].includes(errCode)) {
        await supabase
          .from('workspace_slack_connections')
          .update({ connection_status: 'channel_missing' })
          .eq('id', connection.id)
      }

      return { success: false, outcome: 'slack_api_error', error: postResult.error }
    }

    // Clear any previous error status on successful delivery
    if (connection.connection_status !== 'connected') {
      await supabase
        .from('workspace_slack_connections')
        .update({ connection_status: 'connected' })
        .eq('id', connection.id)
    }

    return { success: true, outcome: 'delivered' }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown dispatcher error'
    console.error('[Slack Dispatcher] Exception caught while dispatching:', err)
    return { success: false, outcome: 'exception', error: errorMsg }
  }
}
