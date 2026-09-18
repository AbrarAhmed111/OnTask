import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { BlockersSection } from '@/components/workspaces/WorkspaceSummarySection'
import type { StructuredSnapshotBlocker } from '@/types/workspace'

const blocker = (
  overrides: Partial<StructuredSnapshotBlocker> = {},
): StructuredSnapshotBlocker => ({
  blocker_id: 'b-1',
  task_id: 't-1',
  task_title: 'Student API',
  parent_title: null,
  goal_id: null,
  goal_name: null,
  reason: 'Waiting for API credentials from @Araysh.',
  blocked_by_user_id: 'u-abrar',
  blocked_by_name: 'Abrar Ahmed',
  blocked_at: '2026-09-19T09:00:00Z',
  mentioned: [{ user_id: 'u-araysh', display_name: 'Araysh Khan' }],
  resolved_at: '2026-09-19T11:00:00Z',
  resolved_by_user_id: 'u-araysh',
  resolved_by_name: 'Araysh Khan',
  resolution_note: 'API credentials have been provided.',
  still_blocked_at_report_end: false,
  blocked_seconds: 7200,
  ...overrides,
})

const render = (blockers: StructuredSnapshotBlocker[]) =>
  renderToStaticMarkup(<BlockersSection blockers={blockers} />)

describe('the Daily Report blockers section', () => {
  it('shows nothing when no blocker overlapped the period', () => {
    expect(render([])).toBe('')
  })

  it('records a resolved blocker: the reason as written, who was asked, who resolved it and what changed', () => {
    const html = render([blocker()])
    expect(html).toContain('Student API')
    expect(html).toContain('Waiting for API credentials from @Araysh.')
    expect(html).toContain('Reported by Abrar Ahmed')
    expect(html).toContain('asked Araysh Khan')
    expect(html).toContain('Resolved by Araysh Khan')
    expect(html).toContain('API credentials have been provided.')
    expect(html).toContain('Resolved')
    expect(html).not.toContain('Still blocked')
  })

  it('states the time blocked from the recorded seconds', () => {
    expect(render([blocker({ blocked_seconds: 7200 })])).toContain(
      'blocked 2h 0m in this period',
    )
  })

  it('reports a blocker still open at the end of the period as still blocked, with no resolution', () => {
    const html = render([
      blocker({
        resolved_at: null,
        resolved_by_user_id: null,
        resolved_by_name: null,
        resolution_note: null,
        still_blocked_at_report_end: true,
      }),
    ])
    expect(html).toContain('Still blocked')
    expect(html).not.toContain('Resolved by')
  })

  it('lists every blocker, and keeps a subtask’s parent', () => {
    const html = render([
      blocker(),
      blocker({
        blocker_id: 'b-2',
        task_title: 'Auth',
        parent_title: 'School MVP',
        mentioned: [],
      }),
    ])
    expect(html).toContain('Student API')
    expect(html).toContain('Auth (under School MVP)')
  })

  it('does not invent a resolver for a blocker resolved by someone who has left', () => {
    expect(render([blocker({ resolved_by_name: null })])).toContain(
      'Resolved by a former member',
    )
  })
})
