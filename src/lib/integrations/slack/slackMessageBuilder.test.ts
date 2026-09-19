import { describe, expect, it } from 'vitest'
import { buildSlackEventMessage } from './slackMessageBuilder'

describe('buildSlackEventMessage', () => {
  it('formats task assignment message correctly', () => {
    const message = buildSlackEventMessage({
      workspaceName: 'DevAbby',
      workspaceSlug: 'devabby',
      eventType: 'assigned',
      taskTitle: 'Student CRUD API',
      taskId: 'task-123',
      actorName: 'Abrar',
      recipientName: 'Araysh',
    })

    expect(message.fallbackText).toContain('Abrar assigned "Student CRUD API"')
    expect(message.blocks).toHaveLength(4)
    expect(JSON.stringify(message.blocks)).toContain('Task Assigned')
    expect(JSON.stringify(message.blocks)).toContain('*Workspace:* DevAbby')
    expect(JSON.stringify(message.blocks)).toContain(
      'http://localhost:3000/workspaces/devabby?task=task-123',
    )
  })

  it('formats task completion message correctly', () => {
    const message = buildSlackEventMessage({
      workspaceName: 'DevAbby',
      workspaceSlug: 'devabby',
      eventType: 'completed',
      taskTitle: 'Student CRUD API',
      taskId: 'task-123',
      actorName: 'Araysh',
    })

    expect(message.fallbackText).toContain(
      'Araysh completed "Student CRUD API"',
    )
    expect(JSON.stringify(message.blocks)).toContain('Task Completed')
    expect(JSON.stringify(message.blocks)).toContain('*Workspace:* DevAbby')
  })

  it('formats task blocker message correctly', () => {
    const message = buildSlackEventMessage({
      workspaceName: 'DevAbby',
      workspaceSlug: 'devabby',
      eventType: 'blocker_created',
      taskTitle: 'Payment Integration',
      taskId: 'task-456',
      actorName: 'Abrar',
      blockerReason: 'Waiting for Stripe credentials',
    })

    expect(message.fallbackText).toContain(
      'Task Blocked: "Payment Integration"',
    )
    expect(JSON.stringify(message.blocks)).toContain(
      'Waiting for Stripe credentials',
    )
    expect(JSON.stringify(message.blocks)).toContain('Task Blocked')
    expect(JSON.stringify(message.blocks)).toContain('*Workspace:* DevAbby')
  })

  it('formats mention message correctly', () => {
    const message = buildSlackEventMessage({
      workspaceName: 'DevAbby',
      workspaceSlug: 'devabby',
      eventType: 'mentioned',
      taskTitle: 'Payment Integration',
      taskId: 'task-456',
      actorName: 'Abrar',
      recipientName: 'Araysh',
      blockerReason: 'Waiting for Stripe credentials',
    })

    expect(message.fallbackText).toContain('Abrar mentioned Araysh')
    expect(JSON.stringify(message.blocks)).toContain('Mentioned in a Blocker')
    expect(JSON.stringify(message.blocks)).toContain(
      'Waiting for Stripe credentials',
    )
    expect(JSON.stringify(message.blocks)).toContain('*Workspace:* DevAbby')
  })

  it('formats Daily Report message correctly', () => {
    const message = buildSlackEventMessage({
      workspaceName: 'DevAbby',
      workspaceSlug: 'devabby',
      eventType: 'daily_report_ready',
      reportId: 'report-789',
    })

    expect(message.fallbackText).toContain('Daily Report is ready')
    expect(JSON.stringify(message.blocks)).toContain('Daily Report')
    expect(JSON.stringify(message.blocks)).toContain(
      'http://localhost:3000/workspaces/devabby?report=report-789',
    )
  })
})
