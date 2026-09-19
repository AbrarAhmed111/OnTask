/**
 * Slack Block Kit Message Builder for OnTask events.
 * Constructs visually engaging, structured messages with deep links back to OnTask.
 */

import { getTaskUrl, getReportUrl } from './slackUrl'

export interface EventSlackPayload {
  workspaceName: string
  workspaceSlug: string
  eventType: string
  taskTitle?: string
  taskId?: string
  actorName?: string
  recipientName?: string
  blockerReason?: string
  reportId?: string
}

export interface SlackMessagePayload {
  fallbackText: string
  blocks: unknown[]
}

export function buildSlackEventMessage(
  payload: EventSlackPayload,
): SlackMessagePayload {
  const {
    workspaceName,
    workspaceSlug,
    eventType,
    taskTitle = 'Untitled Task',
    taskId,
    actorName = 'Someone',
    recipientName,
    blockerReason,
    reportId,
  } = payload

  const taskUrl = taskId
    ? getTaskUrl(workspaceSlug, taskId)
    : getReportUrl(workspaceSlug)
  const reportUrl = getReportUrl(workspaceSlug, reportId)

  switch (eventType) {
    case 'assigned':
    case 'reassigned': {
      const isReassigned = eventType === 'reassigned'
      const verb = isReassigned ? 'reassigned' : 'assigned'
      const recipientText = recipientName
        ? ` to *${escapeSlackText(recipientName)}*`
        : ''
      const fallbackText = `${actorName} ${verb} "${taskTitle}"${recipientName ? ` to ${recipientName}` : ''}`
      return {
        fallbackText: `[${workspaceName}] ${fallbackText}`,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: isReassigned ? '📋 Task Reassigned' : '📋 Task Assigned',
              emoji: true,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*${escapeSlackText(actorName)}* ${verb} *<${taskUrl}|${escapeSlackText(taskTitle)}>*${recipientText}.`,
            },
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `*Workspace:* ${escapeSlackText(workspaceName)}`,
              },
            ],
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'Open in OnTask',
                  emoji: true,
                },
                url: taskUrl,
                style: 'primary',
              },
            ],
          },
        ],
      }
    }

    case 'completed': {
      const fallbackText = `[${workspaceName}] ${actorName} completed "${taskTitle}"`
      return {
        fallbackText,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '✅ Task Completed',
              emoji: true,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*${escapeSlackText(actorName)}* completed *<${taskUrl}|${escapeSlackText(taskTitle)}>*.`,
            },
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `*Workspace:* ${escapeSlackText(workspaceName)}`,
              },
            ],
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'Open in OnTask',
                  emoji: true,
                },
                url: taskUrl,
              },
            ],
          },
        ],
      }
    }

    case 'reopened': {
      const fallbackText = `[${workspaceName}] ${actorName} reopened "${taskTitle}"`
      return {
        fallbackText,
        blocks: [
          {
            type: 'header',
            text: { type: 'plain_text', text: '🔄 Task Reopened', emoji: true },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*${escapeSlackText(actorName)}* reopened *<${taskUrl}|${escapeSlackText(taskTitle)}>*.`,
            },
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `*Workspace:* ${escapeSlackText(workspaceName)}`,
              },
            ],
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'Open in OnTask',
                  emoji: true,
                },
                url: taskUrl,
              },
            ],
          },
        ],
      }
    }

    case 'blocker_created': {
      const reasonText = blockerReason
        ? `\n\n*Reason:* _${escapeSlackText(blockerReason)}_`
        : ''
      const fallbackText = `[${workspaceName}] Task Blocked: "${taskTitle}"`
      return {
        fallbackText,
        blocks: [
          {
            type: 'header',
            text: { type: 'plain_text', text: '🚨 Task Blocked', emoji: true },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*<${taskUrl}|${escapeSlackText(taskTitle)}>* has been blocked by *${escapeSlackText(actorName)}*.${reasonText}`,
            },
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `*Workspace:* ${escapeSlackText(workspaceName)}`,
              },
            ],
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'Open in OnTask',
                  emoji: true,
                },
                url: taskUrl,
                style: 'danger',
              },
            ],
          },
        ],
      }
    }

    case 'mentioned': {
      const fallbackText = recipientName
        ? `[${workspaceName}] ${actorName} mentioned ${recipientName} on "${taskTitle}"`
        : `[${workspaceName}] ${actorName} mentioned someone on "${taskTitle}"`
      const recipientText = recipientName
        ? `*${escapeSlackText(recipientName)}*`
        : 'someone'
      const reasonText = blockerReason
        ? `\n\n*Reason:* _${escapeSlackText(blockerReason)}_`
        : ''
      return {
        fallbackText,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '👋 Mentioned in a Blocker',
              emoji: true,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*${escapeSlackText(actorName)}* mentioned ${recipientText} on *<${taskUrl}|${escapeSlackText(taskTitle)}>*.${reasonText}`,
            },
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `*Workspace:* ${escapeSlackText(workspaceName)}`,
              },
            ],
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'Open in OnTask',
                  emoji: true,
                },
                url: taskUrl,
                style: 'primary',
              },
            ],
          },
        ],
      }
    }

    case 'blocker_resolved':
    case 'task_unblocked': {
      const fallbackText = `[${workspaceName}] Blocker Resolved on "${taskTitle}"`
      return {
        fallbackText,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '🎉 Blocker Resolved',
              emoji: true,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `The blocker on *<${taskUrl}|${escapeSlackText(taskTitle)}>* was resolved by *${escapeSlackText(actorName)}*.`,
            },
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `*Workspace:* ${escapeSlackText(workspaceName)}`,
              },
            ],
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'Open in OnTask',
                  emoji: true,
                },
                url: taskUrl,
                style: 'primary',
              },
            ],
          },
        ],
      }
    }

    case 'daily_report_ready': {
      const fallbackText = `[${workspaceName}] Daily Report is ready`
      return {
        fallbackText,
        blocks: [
          {
            type: 'header',
            text: { type: 'plain_text', text: '📊 Daily Report', emoji: true },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `The Daily Report for *${escapeSlackText(workspaceName)}* is ready.`,
            },
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'View Daily Report',
                  emoji: true,
                },
                url: reportUrl,
                style: 'primary',
              },
            ],
          },
        ],
      }
    }

    default: {
      const fallbackText = `[${workspaceName}] Update on "${taskTitle}"`
      return {
        fallbackText,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*${actorName}* updated *<${taskUrl}|${escapeSlackText(taskTitle)}>* in *${escapeSlackText(workspaceName)}*.`,
            },
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'Open in OnTask',
                  emoji: true,
                },
                url: taskUrl,
              },
            ],
          },
        ],
      }
    }
  }
}

function escapeSlackText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
