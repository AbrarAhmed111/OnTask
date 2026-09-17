'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AuthUser } from '@/hooks/useAuth'

// Who currently has this workspace open — a Supabase Realtime Presence
// channel, purely ephemeral/in-memory on Supabase's side (no table, no
// migration). "Online" means "has this workspace's tab open right now",
// not last-seen — the presence set is cleared the moment a tab closes or
// loses its connection.
export function useWorkspacePresence(
  workspaceId: string,
  user: AuthUser | null,
) {
  const userId = user?.id
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!userId || !workspaceId) {
      setOnlineUserIds(new Set())
      return
    }
    const supabase = createClient()
    const channel = supabase.channel(`presence:workspace:${workspaceId}`, {
      config: { presence: { key: userId } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        setOnlineUserIds(new Set(Object.keys(channel.presenceState())))
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') {
          void channel.track({ online_at: new Date().toISOString() })
        }
      })

    return () => {
      setOnlineUserIds(new Set())
      supabase.removeChannel(channel)
    }
  }, [userId, workspaceId])

  return onlineUserIds
}
