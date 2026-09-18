import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { WorkspaceSettingsSection } from '@/components/workspaces/WorkspaceSettingsSection'
import type { Workspace } from '@/types/workspace'

const noop = () => {}

const workspace = (overrides: Partial<Workspace> = {}): Workspace => ({
  id: 'w1',
  slug: 'design-team',
  type: 'shared',
  name: 'Design Team',
  description: 'Where we design',
  ownerId: 'u1',
  timezone: 'Europe/London',
  reportTime: '09:00:00',
  accent: 'ocean',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  ...overrides,
})

const render = (
  props: Partial<Parameters<typeof WorkspaceSettingsSection>[0]> = {},
) =>
  renderToStaticMarkup(
    <WorkspaceSettingsSection
      ready
      workspace={workspace()}
      canManage
      preferences={{
        ready: true,
        soundEnabled: true,
        onSoundEnabledChange: noop,
      }}
      onEdit={noop}
      {...props}
    />,
  )

describe('WorkspaceSettingsSection', () => {
  it('lays settings cards out responsively', () => {
    const html = render()
    expect(html).toContain('md:grid-cols-2')
    expect(html).toContain('xl:grid-cols-3')
  })

  it('offers editing the workspace to its owner only', () => {
    expect(render({ canManage: true })).toContain('>Edit<')
    expect(render({ canManage: false })).not.toContain('>Edit<')
  })

  it("still shows a member the workspace's details, read-only", () => {
    const html = render({ canManage: false })
    expect(html).toContain('Design Team')
    expect(html).toContain('Europe/London')
    expect(html).toContain('Ocean')
  })

  it('gives every member their own preferences, owner or not', () => {
    for (const canManage of [true, false]) {
      const html = render({ canManage })
      expect(html).toContain('Your preferences')
      expect(html).toContain('Completion sound')
    }
  })

  it('reflects the saved completion-sound preference', () => {
    const on = render({
      preferences: {
        ready: true,
        soundEnabled: true,
        onSoundEnabledChange: noop,
      },
    })
    const off = render({
      preferences: {
        ready: true,
        soundEnabled: false,
        onSoundEnabledChange: noop,
      },
    })
    expect(on).toContain('checked=""')
    expect(off).not.toContain('checked=""')
  })

  it("disables the preference until it has loaded, so the default can't be saved over it", () => {
    const html = render({
      preferences: {
        ready: false,
        soundEnabled: true,
        onSoundEnabledChange: noop,
      },
    })
    expect(html).toContain('disabled=""')
  })

  it('shows a personal workspace with its fixed name and no description', () => {
    const html = render({
      isPersonal: true,
      workspace: workspace({ type: 'personal', name: 'anything' }),
    })
    expect(html).toContain('Personal Workspace settings')
    expect(html).toContain('Personal Workspace')
    expect(html).not.toContain('anything')
    expect(html).not.toContain('Description')
  })

  it('shows a shared workspace with its name and description', () => {
    const html = render()
    expect(html).toContain('Workspace details')
    expect(html).toContain('Description')
    expect(html).toContain('Where we design')
  })

  it('shows placeholders while the workspace is loading', () => {
    const html = render({ ready: false, workspace: null })
    expect(html).not.toContain('Timezone')
  })

  it('surfaces a save error inside the details card', () => {
    expect(render({ error: 'Could not save' })).toContain('Could not save')
  })

  describe('Help & guidance', () => {
    const guidance = { label: 'Shared Workspace tour', onReplay: noop }

    it('offers to replay the workspace tour, named for the workspace', () => {
      const html = render({ guidance })
      expect(html).toContain('Help &amp; guidance')
      expect(html).toContain('Replay Shared Workspace tour')
    })

    it('leaves the card out when there is no tour to replay', () => {
      expect(render()).not.toContain('Help &amp; guidance')
    })

    it('is offered to every member, not only the owner', () => {
      expect(render({ canManage: false, guidance })).toContain(
        'Replay Shared Workspace tour',
      )
    })

    it("waits for the workspace to load, since the tour can't start without it", () => {
      const loading = render({
        ready: false,
        workspace: null,
        canManage: false,
        guidance,
      })
      const loaded = render({ canManage: false, guidance })
      expect(loading).toContain('disabled=""')
      expect(loaded).not.toContain('disabled=""')
    })
  })
})
