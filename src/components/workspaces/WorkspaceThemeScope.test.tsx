import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { usePortalTheme } from '@/components/ui/PortalTheme'
import { WorkspaceThemeScope } from '@/components/workspaces/WorkspaceThemeScope'

// Stands in for a dialog the layout opens beside the shell (invite, welcome,
// guest-work prompt): it isn't inside the shell's DOM, so it only gets the
// accent through the portal context that Modal reads.
function DialogProbe() {
  const theme = usePortalTheme() as Record<string, string> | undefined
  return <p data-accent={theme?.['--ws-accent'] ?? 'none'} />
}

const render = (accent: string | null | undefined) =>
  renderToStaticMarkup(
    <WorkspaceThemeScope accent={accent}>
      <DialogProbe />
    </WorkspaceThemeScope>,
  )

describe('WorkspaceThemeScope', () => {
  it("sets the workspace's accent for everything beneath it", () => {
    const html = render('berry')

    expect(html).toContain('--ws-accent:#8b3a6b')
    expect(html).toContain('--ws-accent-soft:#f5e7f0')
  })

  it('hands the same accent to dialogs rendered outside the shell', () => {
    expect(render('berry')).toContain('data-accent="#8b3a6b"')
    expect(render('ocean')).toContain('data-accent="#2b6cb0"')
  })

  it('falls back to the default accent for a missing or unknown id', () => {
    for (const accent of [undefined, null, '', 'not-a-theme']) {
      expect(render(accent)).toContain('data-accent="#375b4b"')
    }
  })

  it('adds no box of its own to the page layout', () => {
    expect(render('berry')).toContain('class="contents"')
  })
})
