'use client'

import { ReactNode, useState } from 'react'
import { LogOut } from 'lucide-react'
import { DropdownPanel } from '@/components/ui/DropdownPanel'
import type { AuthUser } from '@/hooks/useAuth'

// The signed-in user's account dropdown: who they are, any page-specific
// entries, and Log out. The trigger differs by page (a bare avatar on the
// landing/hub header, a name pill inside a workspace), so the caller renders
// it; the menu itself — and the open/close behavior — is the same everywhere.
export function AccountMenu({
  user,
  onLogout,
  renderTrigger,
  extraItems,
}: {
  user: AuthUser
  onLogout: () => void
  renderTrigger: (state: { open: boolean; toggle: () => void }) => ReactNode
  // Entries between the identity block and Log out. Handed `close` so a link
  // can dismiss the menu when followed.
  extraItems?: (close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return (
    <div className="relative">
      {renderTrigger({ open, toggle: () => setOpen(current => !current) })}
      {open && (
        <DropdownPanel onClose={close} className="w-52 p-2">
          <div className="border-b border-line/70 px-2.5 py-2">
            <p className="truncate text-xs font-bold text-ink">
              {user.fullName || 'Your account'}
            </p>
            {user.email && (
              <p className="truncate text-[10px] text-muted">{user.email}</p>
            )}
          </div>
          {extraItems?.(close)}
          <button
            onClick={() => {
              close()
              onLogout()
            }}
            className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-coral transition hover:bg-coral/10"
          >
            <LogOut size={14} /> Log out
          </button>
        </DropdownPanel>
      )}
    </div>
  )
}
