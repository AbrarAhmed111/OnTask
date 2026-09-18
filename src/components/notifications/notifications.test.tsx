import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { NotificationPanel } from '@/components/notifications/NotificationPanel'
import type { NotificationWithWorkspace } from '@/types/workspace'

const noop = () => {}

const notification = (
  overrides: Partial<NotificationWithWorkspace> = {},
): NotificationWithWorkspace => ({
  id: 'n-1',
  userId: 'user-araysh',
  workspaceId: 'ws-alpha',
  eventId: 'e-1',
  goalId: null,
  notificationType: 'blocker_mention',
  entityType: 'task',
  entityId: 'task-7',
  title: 'Abrar Ahmed mentioned you in a blocker',
  body: 'Student API\nWaiting for API credentials from @Araysh.',
  actorId: 'user-abrar',
  readAt: null,
  createdAt: new Date().toISOString(),
  workspaceSlug: 'team-alpha',
  workspaceName: 'Team Alpha',
  workspaceType: 'shared',
  workspaceAccent: 'ocean',
  ...overrides,
})

const render = (notifications: NotificationWithWorkspace[]) =>
  renderToStaticMarkup(
    <NotificationPanel
      notifications={notifications}
      ready
      unreadCount={notifications.filter(n => !n.readAt).length}
      groupByWorkspace={false}
      onMarkRead={noop}
      onMarkAllRead={noop}
      onNavigate={noop}
    />,
  )

describe('NotificationPanel with a blocker mention', () => {
  it('says who asked, and shows the task and the reason', () => {
    const html = render([notification()])
    expect(html).toContain('Abrar Ahmed mentioned you in a blocker')
    expect(html).toContain('Student API')
    expect(html).toContain('Waiting for API credentials from @Araysh.')
  })

  it('opens the task it is about, in the workspace it came from', () => {
    expect(render([notification()])).toContain(
      'href="/workspaces/team-alpha?task=task-7"',
    )
  })

  it('shows as unread until it has been read', () => {
    expect(render([notification()])).toContain('bg-coral')
    expect(
      render([notification({ readAt: '2026-01-01T00:00:00Z' })]),
    ).not.toContain('h-1.5 w-1.5 shrink-0 rounded-full bg-coral')
  })

  it('keeps the task and the reason on their own lines', () => {
    expect(render([notification()])).toContain('whitespace-pre-line')
  })

  it('still links a notification that is not about a task to just its workspace', () => {
    const html = render([
      notification({
        notificationType: 'member_joined',
        entityType: 'workspace',
        entityId: null,
        title: 'Someone joined the workspace',
        body: 'Rachel',
      }),
    ])
    expect(html).toContain('href="/workspaces/team-alpha"')
    expect(html).not.toContain('?task=')
  })
})
