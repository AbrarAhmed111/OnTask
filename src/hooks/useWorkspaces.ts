'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AuthUser } from '@/hooks/useAuth'
import { Workspace } from '@/types/workspace'

type WorkspaceRow = {
  id: string
  name: string
  description: string | null
  owner_id: string
  timezone: string
  accent: string
  created_at: string
  updated_at: string
}

function rowToWorkspace(row: WorkspaceRow): Workspace {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    ownerId: row.owner_id,
    timezone: row.timezone,
    accent: row.accent,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// List + create for the /workspaces page. Detail data (members, tasks) lives
// in useWorkspace, fetched separately per workspace page.
export function useWorkspaces(user: AuthUser | null) {
  const userId = user?.id
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({})
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) {
      setWorkspaces([])
      setMemberCounts({})
      setReady(true)
      return
    }
    let cancelled = false
    setReady(false)
    const supabase = createClient()
    supabase
      .from('workspaces')
      .select('*')
      .order('created_at', { ascending: false })
      .then(async ({ data, error: fetchError }) => {
        if (cancelled) return
        if (fetchError) {
          setError("Couldn't load your workspaces.")
          setReady(true)
          return
        }
        const rows = (data ?? []) as WorkspaceRow[]
        setWorkspaces(rows.map(rowToWorkspace))
        setReady(true)
        if (rows.length === 0) return

        const { data: members } = await supabase
          .from('workspace_members')
          .select('workspace_id')
          .in(
            'workspace_id',
            rows.map(row => row.id),
          )
        if (cancelled) return
        const counts: Record<string, number> = {}
        ;(members ?? []).forEach(member => {
          const key = (member as { workspace_id: string }).workspace_id
          counts[key] = (counts[key] ?? 0) + 1
        })
        setMemberCounts(counts)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  const createWorkspace = async (
    name: string,
    description: string,
    timezone: string,
  ) => {
    if (!userId) return { success: false as const, error: 'Not signed in.' }
    const supabase = createClient()
    const { data, error: rpcError } = await supabase.rpc('create_workspace', {
      p_name: name,
      p_description: description.trim() || null,
      p_timezone: timezone,
    })
    if (rpcError || !data) {
      return {
        success: false as const,
        error: rpcError?.message ?? 'Failed to create workspace.',
      }
    }
    const workspace = rowToWorkspace(data as WorkspaceRow)
    setWorkspaces(current => [workspace, ...current])
    setMemberCounts(current => ({ ...current, [workspace.id]: 1 }))
    return { success: true as const, workspace }
  }

  return { workspaces, memberCounts, ready, error, createWorkspace }
}
