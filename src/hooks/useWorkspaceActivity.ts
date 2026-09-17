'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AuthUser } from '@/hooks/useAuth'

type TaskEventRow = {
  id: string
  task_id: string
  actor_id: string
  event_type: string
  metadata: Record<string, unknown>
  created_at: string
}

export type ActivityEvent = {
  id: string
  taskId: string
  actorId: string
  eventType: string
  metadata: Record<string, unknown>
  createdAt: string
}

function rowToEvent(row: TaskEventRow): ActivityEvent {
  return {
    id: row.id,
    taskId: row.task_id,
    actorId: row.actor_id,
    eventType: row.event_type,
    metadata: row.metadata,
    createdAt: row.created_at,
  }
}

// Recent activity for a workspace — reads task_events (populated by the
// timer RPCs and the paired client-side inserts in useWorkspaceTasks),
// live-updated via the same postgres_changes pattern as the task list.
export function useWorkspaceActivity(
  workspaceId: string,
  user: AuthUser | null,
  limit = 30,
) {
  const userId = user?.id
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!userId || !workspaceId) {
      setEvents([])
      setReady(true)
      return
    }
    let cancelled = false
    const supabase = createClient()

    supabase
      .from('task_events')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(limit)
      .then(({ data }) => {
        if (cancelled || !data) return
        setEvents((data as TaskEventRow[]).map(rowToEvent))
        setReady(true)
      })

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
          setEvents(current => [incoming, ...current].slice(0, limit))
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [userId, workspaceId, limit])

  return { events, ready }
}
