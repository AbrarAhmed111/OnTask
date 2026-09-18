'use client'

import { createContext, ReactNode, useContext } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications } from '@/hooks/useNotifications'

type NotificationsContextValue = ReturnType<typeof useNotifications>

const NotificationsContext = createContext<NotificationsContextValue | null>(
  null,
)

// Mounted once at the app root (src/app/layout.tsx) so both the personal
// dashboard's Header and every workspace's WorkspaceShell can render a bell
// off the same live subscription, instead of each opening its own — a
// person's notifications span every workspace they're in, not just the one
// they're currently viewing.
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const value = useNotifications(user)
  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotificationsContext() {
  const ctx = useContext(NotificationsContext)
  if (!ctx) {
    throw new Error(
      'useNotificationsContext must be used within NotificationsProvider',
    )
  }
  return ctx
}
