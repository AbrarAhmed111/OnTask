'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { mergeById } from '@/lib/realtime/mergeById'
import type { AuthUser } from '@/hooks/useAuth'

type TaskEventRow = {
  id: string
  task_id: string
  goal_id: string | null
  actor_id: string
  event_type: string
  metadata: Record<string, unknown>
  created_at: string
}

export type ActivityEvent = {
  id: string
  taskId: string
  goalId: string | null
  actorId: string
  eventType: string
  metadata: Record<string, unknown>
  createdAt: string
}

function rowToEvent(row: TaskEventRow): ActivityEvent {
  return {
    id: row.id,
    taskId: row.task_id,
    goalId: row.goal_id,
    actorId: row.actor_id,
    eventType: row.event_type,
    metadata: row.metadata,
    createdAt: row.created_at,
  }
}

// Recent activity for a workspace — reads task_events (populated by the
// timer RPCs and the paired client-side inserts in useWorkspaceTasks),
// live-updated via the same postgres_changes pattern as the task list.
// Incoming rows are merged by id (mergeById) rather than blindly prepended,
// so a reconnect refetch or a redelivered event can never render a
// duplicate row or replay its entrance animation.
export function useWorkspaceActivity(
  workspaceId: string,
  user: AuthUser | null,
  limit = 30,
) {
  const userId = user?.id
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId || !workspaceId) {
      setEvents([])
      setReady(true)
      return
    }
    let cancelled = false
    const supabase = createClient()

    const fetchEvents = (showLoading: boolean) => {
      if (showLoading) setReady(false)
      supabase
        .from('task_events')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(limit)
        .then(({ data, error: fetchError }) => {
          if (cancelled) return
          if (fetchError || !data) {
            setError("Couldn't load activity.")
            setReady(true)
            return
          }
          setEvents((data as TaskEventRow[]).map(rowToEvent))
          setReady(true)
        })
    }

    fetchEvents(true)

    // A dropped websocket (laptop sleep, network blip) can silently miss
    // postgres_changes events — coming back online or back into the tab
    // always re-derives the recent activity list from the database, the
    // same resilience pattern as useWorkspaceTasks.ts.
    const handleReconnect = () => fetchEvents(false)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') handleReconnect()
    }
    window.addEventListener('online', handleReconnect)
    document.addEventListener('visibilitychange', handleVisibility)

    const channel = supabase
      .channel(`workspace-activity-${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'task_events',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        payload => {
          if (cancelled) return
          const incoming = rowToEvent(payload.new as TaskEventRow)
          setEvents(current =>
            mergeById(
              current,
              [incoming],
              event => new Date(event.createdAt).getTime(),
              limit,
            ),
          )
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      window.removeEventListener('online', handleReconnect)
      document.removeEventListener('visibilitychange', handleVisibility)
      supabase.removeChannel(channel)
    }
  }, [userId, workspaceId, limit])

  return { events, ready, error }
}
