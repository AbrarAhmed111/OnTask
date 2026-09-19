import { NextResponse } from 'next/server'
import { dispatchSlackNotification } from '@/lib/integrations/slack/slackDispatcher'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      workspaceId,
      eventType,
      taskId,
      taskTitle,
      actorId,
      recipientUserId,
      blockerReason,
      reportId,
    } = body

    if (!workspaceId || !eventType) {
      return NextResponse.json(
        { error: 'workspaceId and eventType are required' },
        { status: 400 },
      )
    }

    const result = await dispatchSlackNotification({
      workspaceId,
      eventType,
      taskId,
      taskTitle,
      actorId,
      recipientUserId,
      blockerReason,
      reportId,
    })

    return NextResponse.json(result)
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to dispatch Slack message'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
