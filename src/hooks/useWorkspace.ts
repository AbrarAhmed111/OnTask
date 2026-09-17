'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AuthUser } from '@/hooks/useAuth'
import { Workspace, WorkspaceMember, WorkspaceRole } from '@/types/workspace'

type WorkspaceRow = {
  id: string
  name: string
  description: string | null
  owner_id: string
  timezone: string
  created_at: string
  updated_at: string
}

type WorkspaceMemberRow = {
  id: string
  workspace_id: string
  user_id: string
  role: WorkspaceRole
  joined_at: string
  profiles: {
    full_name: string | null
    email: string | null
    avatar_url: string | null
  } | null
}

function rowToWorkspace(row: WorkspaceRow): Workspace {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    ownerId: row.owner_id,
    timezone: row.timezone,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function rowToMember(row: WorkspaceMemberRow): WorkspaceMember {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    role: row.role,
    joinedAt: row.joined_at,
    fullName: row.profiles?.full_name ?? null,
    email: row.profiles?.email ?? null,
    avatarUrl: row.profiles?.avatar_url ?? null,
  }
}

// Single-workspace detail: the workspace row, its member list (with profile
// info embedded via the profiles FK — see 0004's migration comment), and the
// caller's own role, so pages can show owner-only controls contextually.
export function useWorkspace(workspaceId: string, user: AuthUser | null) {
  const userId = user?.id
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId || !workspaceId) {
      setReady(true)
      return
    }
    let cancelled = false
    const supabase = createClient()

    const fetchMembers = () =>
      supabase
        .from('workspace_members')
        .select('*, profiles(full_name, email, avatar_url)')
        .eq('workspace_id', workspaceId)
        .order('joined_at', { ascending: true })
        .then(({ data }) => {
          if (cancelled || !data) return
          setMembers((data as WorkspaceMemberRow[]).map(rowToMember))
        })

    setReady(false)
    setError(null)
    Promise.all([
      supabase.from('workspaces').select('*').eq('id', workspaceId).single(),
      fetchMembers(),
    ]).then(([workspaceResult]) => {
      if (cancelled) return
      if (workspaceResult.error || !workspaceResult.data) {
        setError(
          "Couldn't load this workspace — it may not exist, or you may not be a member.",
        )
        setReady(true)
        return
      }
      setWorkspace(rowToWorkspace(workspaceResult.data as WorkspaceRow))
      setReady(true)
    })

    // Realtime payloads carry only the raw row (no embedded profiles join),
    // so a member-joined/removed event just triggers a fresh fetch of the
    // full list rather than trying to merge a partial row.
    const channel = supabase
      .channel(`workspace-members-${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workspace_members',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => {
          if (!cancelled) fetchMembers()
        },
      )
      .subscribe()

    const handleReconnect = () => fetchMembers()
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') handleReconnect()
    }
    window.addEventListener('online', handleReconnect)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      cancelled = true
      window.removeEventListener('online', handleReconnect)
      document.removeEventListener('visibilitychange', handleVisibility)
      supabase.removeChannel(channel)
    }
  }, [userId, workspaceId])

  const role = members.find(member => member.userId === userId)?.role ?? null

  const updateWorkspace = async (
    patch: Partial<Pick<Workspace, 'name' | 'description' | 'timezone'>>,
  ) => {
    if (!workspace) return { success: false as const, error: 'Not loaded.' }
    const supabase = createClient()
    const row: Record<string, string | null> = {}
    if (patch.name !== undefined) row.name = patch.name
    if (patch.description !== undefined) row.description = patch.description
    if (patch.timezone !== undefined) row.timezone = patch.timezone
    const { error: updateError } = await supabase
      .from('workspaces')
      .update(row)
      .eq('id', workspace.id)
    if (updateError) {
      return { success: false as const, error: updateError.message }
    }
    setWorkspace(current => (current ? { ...current, ...patch } : current))
    return { success: true as const }
  }

  const removeMember = async (memberUserId: string) => {
    if (!workspace) return { success: false as const, error: 'Not loaded.' }
    const supabase = createClient()
    const { error: deleteError } = await supabase
      .from('workspace_members')
      .delete()
      .eq('workspace_id', workspace.id)
      .eq('user_id', memberUserId)
    if (deleteError) {
      return { success: false as const, error: deleteError.message }
    }
    setMembers(current => current.filter(m => m.userId !== memberUserId))
    return { success: true as const }
  }

  return {
    workspace,
    members,
    role,
    ready,
    error,
    updateWorkspace,
    removeMember,
  }
}
