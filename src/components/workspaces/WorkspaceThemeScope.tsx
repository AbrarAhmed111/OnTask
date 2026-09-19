import { ReactNode } from 'react'
import { ThemeScope } from '@/components/ui/PortalTheme'
import { getWorkspaceTheme, workspaceThemeVars } from '@/lib/workspaceThemes'

// The workspace's accent for everything rendered inside a workspace route --
// the shell AND the dialogs the layout opens beside it (invite, welcome, the
// guest-work prompt). It has to sit above all of them: a component only sees
// `--ws-accent` if it is a descendant of whatever sets it, and a modal only
// inherits it through the portal context, so a dialog rendered next to the
// shell instead of inside it used to fall back to the default forest accent
// on every workspace that had picked another one.
//
// `accent` is the live workspace's accent, or the cached one before it has
// loaded (see selectCachedWorkspaceIdentity); an unknown or missing id
// resolves to the default. `contents` keeps this wrapper out of layout.
export function WorkspaceThemeScope({
  accent,
  children,
}: {
  accent: string | null | undefined
  children: ReactNode
}) {
  return (
    <ThemeScope
      vars={workspaceThemeVars(getWorkspaceTheme(accent))}
      className="contents"
    >
      {children}
    </ThemeScope>
  )
}
