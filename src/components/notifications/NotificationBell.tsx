'use client'

import { useMemo, useState } from 'react'
import { Bell } from 'lucide-react'
import { NotificationPanel } from '@/components/notifications/NotificationPanel'
import { useNotifications } from '@/hooks/useNotifications'
import { notificationScopeFor } from '@/lib/workspaceNotifications'
import type { AuthUser } from '@/hooks/useAuth'

// Bell icon + unread badge — the same visual pattern already used for the
// pending-invitation count badge (Header.tsx's Shared-Workspaces button).
// Rendered only from WorkspaceShell, i.e. only inside a workspace: never on
// the /workspaces hub or the guest page. What it shows depends on where it is
// — a shared workspace's bell lists only that workspace's notifications; the
// Personal Workspace's lists its own plus every shared workspace's, each
// labelled with where it came from (see lib/workspaceNotifications.ts).
export function NotificationBell({
  user,
  workspaceId,
  isPersonal,
  className = 'border-line bg-white/60 text-forest hover:border-forest',
}: {
  user: AuthUser
  // '' until a shared workspace has resolved from its slug.
  workspaceId: string
  isPersonal: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const scope = useMemo(
    () => notificationScopeFor({ workspaceId, isPersonal }),
    [workspaceId, isPersonal],
  )
  const { notifications, ready, unreadCount, markRead, markAllRead } =
    useNotifications(user, scope)

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
            ready={ready}
            unreadCount={unreadCount}
            groupByWorkspace={scope?.kind === 'personal'}
            onMarkRead={markRead}
            onMarkAllRead={markAllRead}
            onNavigate={() => setOpen(false)}
          />
        </>
      )}
    </div>
  )
}
