'use client'

import { useState } from 'react'
import { Bell } from 'lucide-react'
import { NotificationPanel } from '@/components/notifications/NotificationPanel'
import { useNotificationsContext } from '@/components/notifications/NotificationsProvider'

// Bell icon + unread badge — the same visual pattern already used for the
// pending-invitation count badge (Header.tsx's Shared-Workspaces button).
// Rendered from both Header.tsx (personal/workspaces-list) and
// WorkspaceShell.tsx (inside a workspace), backed by the single shared
// NotificationsProvider mounted at the app root.
export function NotificationBell({
  className = 'border-line bg-white/60 text-forest hover:border-forest',
}: {
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const { notifications, unreadCount, markRead, markAllRead } =
    useNotificationsContext()

  return (
    <div className="relative">
      <button
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : 'Notifications'
        }
        onClick={() => setOpen(current => !current)}
        className={`relative grid h-9 w-9 place-items-center rounded-lg border transition ${className}`}
      >
        <Bell size={17} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-coral px-1 font-mono text-[9px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <>
          <button
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <NotificationPanel
            notifications={notifications}
            unreadCount={unreadCount}
            onMarkRead={markRead}
            onMarkAllRead={markAllRead}
            onNavigate={() => setOpen(false)}
          />
        </>
      )}
    </div>
  )
}
