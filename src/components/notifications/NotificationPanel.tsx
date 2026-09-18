import Link from 'next/link'
import { Bell, CheckCheck } from 'lucide-react'
import { timeAgo } from '@/lib/time'
import { WorkspaceNotification } from '@/types/workspace'

type Notification = WorkspaceNotification & { workspaceSlug: string | null }

export function NotificationPanel({
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  onNavigate,
}: {
  notifications: Notification[]
  unreadCount: number
  onMarkRead: (id: string) => void
  onMarkAllRead: () => void
  onNavigate: () => void
}) {
  return (
    <div className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-32px)] rounded-xl border border-line bg-panel shadow-xl animate-[fadeIn_150ms_ease-out]">
      <div className="flex items-center justify-between gap-3 border-b border-line/70 px-3.5 py-3">
        <p className="text-xs font-bold text-ink">Notifications</p>
        {unreadCount > 0 && (
          <button
            onClick={onMarkAllRead}
            className="flex items-center gap-1 text-[10px] font-semibold text-muted transition hover:text-ink"
          >
            <CheckCheck size={12} /> Mark all read
          </button>
        )}
      </div>
      <div className="max-h-[360px] overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <Bell size={18} className="mx-auto text-muted" />
            <p className="mt-2 text-[11px] text-muted">
              You&apos;re all caught up.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-line/70">
            {notifications.map(notification => {
              const unread = !notification.readAt
              const href = notification.workspaceSlug
                ? `/workspaces/${notification.workspaceSlug}`
                : '/workspaces'
              return (
                <li
                  key={notification.id}
                  className="animate-[slideInFade_260ms_ease-out]"
                >
                  <Link
                    href={href}
                    onClick={() => {
                      if (unread) onMarkRead(notification.id)
                      onNavigate()
                    }}
                    className={`block px-3.5 py-3 transition hover:bg-slate-50 ${unread ? 'bg-[var(--ws-accent-soft,#e9f0ec)]/40' : ''}`}
                  >
                    <div className="flex items-start gap-2">
                      {unread && (
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-coral" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-ink">
                          {notification.title}
                        </p>
                        {notification.body && (
                          <p className="mt-0.5 truncate text-[11px] text-muted">
                            {notification.body}
                          </p>
                        )}
                        <p className="mt-1 text-[10px] text-muted">
                          {timeAgo(notification.createdAt)}
                        </p>
                      </div>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
