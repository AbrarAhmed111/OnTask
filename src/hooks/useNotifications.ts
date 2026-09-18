import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AuthUser } from '@/hooks/useAuth'
import {
  NotificationEntityType,
  NotificationType,
  WorkspaceNotification,
} from '@/types/workspace'

type NotificationRow = {
  id: string
  user_id: string
  workspace_id: string
  event_id: string | null
  goal_id: string | null
  notification_type: NotificationType
  entity_type: NotificationEntityType
  entity_id: string | null
  title: string
  body: string | null
  actor_id: string | null
  read_at: string | null
  created_at: string
  // Embedded via the workspaces(id) FK — the workspace's slug, needed to
  // deep-link since routing is entirely slug-based (never workspace_id).
  workspaces: { slug: string } | { slug: string }[] | null
}

function rowToNotification(
  row: NotificationRow,
): WorkspaceNotification & { workspaceSlug: string | null } {
  const workspace = Array.isArray(row.workspaces)
    ? row.workspaces[0]
    : row.workspaces
  return {
    id: row.id,
    userId: row.user_id,
    workspaceId: row.workspace_id,
    eventId: row.event_id,
    goalId: row.goal_id,
    notificationType: row.notification_type,
    entityType: row.entity_type,
    entityId: row.entity_id,
    title: row.title,
    body: row.body,
    actorId: row.actor_id,
    readAt: row.read_at,
    createdAt: row.created_at,
    workspaceSlug: workspace?.slug ?? null,
  }
}

const LIMIT = 50

// User-scoped (not workspace-scoped) — a person's notifications span every
// workspace they belong to, so this mounts once at the app root
// (NotificationsProvider) rather than per-workspace like every other hook
// here. Same postgres_changes pattern as the rest of the app; a realtime
// event triggers a full refetch (see comment below) rather than an
// incremental merge, since the embedded workspace slug isn't in the payload.
export function useNotifications(user: AuthUser | null) {
  const userId = user?.id
  const [notifications, setNotifications] = useState<
    (WorkspaceNotification & { workspaceSlug: string | null })[]
  >([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) {
      setNotifications([])
      setReady(true)
      return
    }
    let cancelled = false
    const supabase = createClient()

    const fetchNotifications = (showLoading: boolean) => {
      if (showLoading) setReady(false)
      supabase
        .from('notifications')
        .select('*, workspaces(slug)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(LIMIT)
        .then(({ data, error: fetchError }) => {
          if (cancelled) return
          if (fetchError) {
            setError("Couldn't load notifications.")
            setReady(true)
            return
          }
          setNotifications(
            ((data ?? []) as NotificationRow[]).map(rowToNotification),
          )
          setReady(true)
        })
    }

    fetchNotifications(true)

    const handleReconnect = () => fetchNotifications(false)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') handleReconnect()
    }
    window.addEventListener('online', handleReconnect)
    document.addEventListener('visibilitychange', handleVisibility)

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        payload => {
          if (cancelled) return
          if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id?: string }).id
            if (deletedId)
              setNotifications(current =>
                current.filter(n => n.id !== deletedId),
              )
            return
          }
          // The realtime payload doesn't carry the embedded workspaces(slug)
          // join, so a full refetch keeps that field correct -- new
          // notifications are infrequent enough that this is cheap.
          fetchNotifications(false)
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      window.removeEventListener('online', handleReconnect)
      document.removeEventListener('visibilitychange', handleVisibility)
      supabase.removeChannel(channel)
    }
  }, [userId])

  const markRead = (id: string) => {
    setNotifications(current =>
      current.map(n =>
        n.id === id && !n.readAt
          ? { ...n, readAt: new Date().toISOString() }
          : n,
      ),
    )
    const supabase = createClient()
    void supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
      .then(({ error: updateError }) => {
        if (updateError) setError("Couldn't update the notification.")
      })
  }

  const markAllRead = () => {
    if (!userId) return
    const now = new Date().toISOString()
    setNotifications(current =>
      current.map(n => (n.readAt ? n : { ...n, readAt: now })),
    )
    const supabase = createClient()
    void supabase
      .from('notifications')
      .update({ read_at: now })
      .eq('user_id', userId)
      .is('read_at', null)
      .then(({ error: updateError }) => {
        if (updateError) setError("Couldn't update notifications.")
      })
  }

  const unreadCount = notifications.filter(n => !n.readAt).length

  return { notifications, ready, error, unreadCount, markRead, markAllRead }
}
