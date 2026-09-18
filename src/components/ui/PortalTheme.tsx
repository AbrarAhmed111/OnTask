'use client'

import { createContext, CSSProperties, ReactNode, useContext } from 'react'

// Modals render into <body> (see ui/Modal), so a CSS variable set on an
// ancestor of the code that opens them -- the workspace accent, which
// WorkspaceShell sets as --ws-accent -- no longer reaches them by ordinary
// inheritance. The context hands down the variables that should be
// re-applied to every modal opened beneath it, which keeps a modal inside a
// workspace themed exactly as it was when it rendered in place.
const PortalThemeContext = createContext<CSSProperties | undefined>(undefined)

export function usePortalTheme(): CSSProperties | undefined {
  return useContext(PortalThemeContext)
}

// A wrapper element that sets CSS variables for its subtree AND forwards the
// same ones to portalled modals, so the two can't drift apart.
export function ThemeScope({
  vars,
  className,
  children,
}: {
  vars: CSSProperties
  className?: string
  children: ReactNode
}) {
  return (
    <PortalThemeContext.Provider value={vars}>
      <div style={vars} className={className}>
        {children}
      </div>
    </PortalThemeContext.Provider>
  )
}
