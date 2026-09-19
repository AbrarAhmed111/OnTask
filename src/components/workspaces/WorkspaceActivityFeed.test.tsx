import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { WorkspaceActivityFeed } from '@/components/workspaces/WorkspaceActivityFeed'
import type { ActivityEvent } from '@/hooks/useWorkspaceActivity'
import type { WorkspaceMember } from '@/types/workspace'

const member = (userId: string, fullName: string): WorkspaceMember => ({
  id: `m-${userId}`,
  workspaceId: 'w1',
  userId,
  role: 'member',
  joinedAt: '2026-01-01',
  fullName,
  email: `${userId}@example.com`,
  avatarUrl: null,
})

const members = [member('u-abrar', 'Abrar'), member('u-araysh', 'Araysh')]

const event = (
  eventType: string,
  actorId: string,
  metadata: Record<string, unknown>,
): ActivityEvent => ({
  id: `e-${eventType}`,
  taskId: 't-1',
  goalId: null,
  actorId,
  eventType,
  metadata,
  createdAt: new Date().toISOString(),
})

const feed = (events: ActivityEvent[]) =>
  renderToStaticMarkup(
    <WorkspaceActivityFeed events={events} members={members} />,
  )

describe('WorkspaceActivityFeed — task blockers', () => {
  it('reads "blocked" with the reason', () => {
    const html = feed([
      event('task_blocker_added', 'u-abrar', {
        title: 'Student API',
        reason: 'Waiting for API credentials from @Araysh.',
      }),
    ])
    expect(html).toContain(
      'Abrar blocked &quot;Student API&quot; — Waiting for API credentials from @Araysh.',
    )
  })

  it('says who was mentioned', () => {
    const html = feed([
      event('task_blocker_mention', 'u-abrar', {
        title: 'Student API',
        mentioned_name: 'Araysh',
      }),
    ])
    expect(html).toContain(
      'Abrar mentioned Araysh in the blocker for &quot;Student API&quot;',
    )
  })

  it('says who resolved it, with what changed', () => {
    const html = feed([
      event('task_blocker_resolved', 'u-araysh', {
        title: 'Student API',
        resolution_note: 'API credentials have been provided.',
      }),
    ])
    expect(html).toContain(
      'Araysh resolved the blocker on &quot;Student API&quot; — API credentials have been provided.',
    )
  })

  it('reads a resolution with no note without a dangling dash', () => {
    const html = feed([
      event('task_blocker_resolved', 'u-araysh', {
        title: 'Student API',
        resolution_note: null,
      }),
    ])
    expect(html).toContain(
      'Araysh resolved the blocker on &quot;Student API&quot;',
    )
    expect(html).not.toContain('&quot; —')
  })

  it('says what an edit changed', () => {
    const html = feed([
      event('task_blocker_updated', 'u-abrar', {
        title: 'Student API',
        added: [{ user_id: 'u-araysh', name: 'Araysh' }],
        removed: [{ user_id: 'u-x', name: 'Sam' }],
      }),
    ])
    expect(html).toContain(
      'Abrar updated the blocker on &quot;Student API&quot; (added Araysh; removed Sam)',
    )
  })

  it('reads a wording-only edit plainly', () => {
    const html = feed([
      event('task_blocker_updated', 'u-abrar', {
        title: 'Student API',
        added: [],
        removed: [],
      }),
    ])
    expect(html).toContain(
      'Abrar updated the blocker on &quot;Student API&quot;',
    )
    expect(html).not.toContain('(added')
  })

  it('keeps a subtask’s parent in the sentence', () => {
    const html = feed([
      event('task_blocker_added', 'u-abrar', {
        title: 'Auth',
        parent_title: 'School MVP',
        reason: 'x',
      }),
    ])
    expect(html).toContain('&quot;Auth&quot; under &quot;School MVP&quot;')
  })

  it('does not confuse a blocker with a Goal dependency', () => {
    const html = feed([
      event('task_blocked', 'u-abrar', {
        title: 'Deploy',
        blocking_title: 'Build',
      }),
    ])
    expect(html).toContain(
      '&quot;Deploy&quot; is now blocked by &quot;Build&quot;',
    )
    expect(html).not.toContain('blocker')
  })
})
