import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Bell, FolderOpen } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { PreferenceToggle } from '@/components/ui/PreferenceToggle'

describe('ErrorBanner', () => {
  it('announces its message as an alert', () => {
    const html = renderToStaticMarkup(<ErrorBanner>Boom</ErrorBanner>)
    expect(html).toContain('role="alert"')
    expect(html).toContain('Boom')
  })

  it('has a boxed, a flush and a plain form', () => {
    const boxed = renderToStaticMarkup(<ErrorBanner>x</ErrorBanner>)
    const flush = renderToStaticMarkup(
      <ErrorBanner variant="flush">x</ErrorBanner>,
    )
    const plain = renderToStaticMarkup(
      <ErrorBanner variant="plain">x</ErrorBanner>,
    )
    expect(boxed).toContain('rounded-xl border border-coral/20')
    expect(flush).toContain('border-b border-line/70')
    expect(plain).toContain('px-5 py-4')
    expect(plain).not.toContain('border-b')
  })

  it('takes extra classes for spacing', () => {
    expect(
      renderToStaticMarkup(<ErrorBanner className="mb-6">x</ErrorBanner>),
    ).toContain('mb-6')
  })
})

describe('EmptyState', () => {
  it('is a plain one-line note when it only has a message', () => {
    const html = renderToStaticMarkup(<EmptyState>Nothing yet</EmptyState>)
    expect(html).toContain('Nothing yet')
    expect(html).toContain('text-xs text-muted')
    expect(html).not.toContain('font-semibold')
  })

  it('shows an icon, a title, a description and an action when given them', () => {
    const html = renderToStaticMarkup(
      <EmptyState
        icon={FolderOpen}
        title="No resources yet"
        action={<button>Add</button>}
      >
        Add some files.
      </EmptyState>,
    )
    expect(html).toContain('<svg')
    expect(html).toContain('No resources yet')
    expect(html).toContain('Add some files.')
    expect(html).toContain('<button>Add</button>')
  })

  it('omits the description when there is none', () => {
    const html = renderToStaticMarkup(
      <EmptyState title="No goals yet">{null}</EmptyState>,
    )
    expect(html).toContain('No goals yet')
    expect(html).not.toContain('max-w-xs')
  })
})

describe('Avatar', () => {
  it('shows the photo when there is one', () => {
    const html = renderToStaticMarkup(
      <Avatar person={{ fullName: 'Ada', avatarUrl: 'https://x/y.png' }} />,
    )
    expect(html).toContain('src="https://x/y.png"')
  })

  it("falls back to the person's initial: name, then email, then '?'", () => {
    const initial = (person: Parameters<typeof Avatar>[0]['person']) =>
      renderToStaticMarkup(<Avatar person={person} />)
    expect(initial({ fullName: 'ada', email: 'zed@x.io' })).toContain('>A<')
    expect(initial({ fullName: null, email: 'zed@x.io' })).toContain('>Z<')
    expect(initial({ fullName: null, email: null })).toContain('>?<')
  })

  it('lets the caller size it', () => {
    expect(
      renderToStaticMarkup(
        <Avatar person={{ fullName: 'A' }} className="h-5 w-5" />,
      ),
    ).toContain('h-5 w-5')
  })
})

describe('PreferenceToggle', () => {
  const render = (props: { checked: boolean; disabled?: boolean }) =>
    renderToStaticMarkup(
      <PreferenceToggle
        icon={Bell}
        title="Completion sound"
        description="Play a sound."
        onChange={() => {}}
        {...props}
      />,
    )

  it('shows its title and description', () => {
    const html = render({ checked: false })
    expect(html).toContain('Completion sound')
    expect(html).toContain('Play a sound.')
  })

  it('reflects checked and disabled state', () => {
    expect(render({ checked: true })).toContain('checked=""')
    expect(render({ checked: false })).not.toContain('checked=""')
    expect(render({ checked: true, disabled: true })).toContain('disabled=""')
    expect(render({ checked: true })).not.toContain('disabled=""')
  })
})
