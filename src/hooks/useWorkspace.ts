'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AuthUser } from '@/hooks/useAuth'
import { Workspace, WorkspaceMember, WorkspaceRole } from '@/types/workspace'
import { useAppDispatch } from '@/lib/redux/hooks'
import {
  upsertPersonalWorkspaceIdentity,
  upsertWorkspaceIdentity,
} from '@/lib/redux/workspaceCacheSlice'
import {
  PERSONAL_WORKSPACE_SLUG,
  WorkspaceRow,
  rowToWorkspace,
} from '@/lib/workspaces'

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
//
// `workspaceSlug` is the URL-facing identifier (0019) -- resolved to the
// workspace's real uuid below before anything else (members, invitations,
// presence, tasks, the Daily Report) queries by workspace_id, since every
// other table's FK -- and every realtime filter -- is keyed by that uuid,
// never the slug.
//
// `personal-workspace` is the one slug that isn't a lookup key: it's the same
// URL for every user and means "MY personal workspace", resolved by owner
// rather than by slug -- so it can only ever resolve to the signed-in user's
// own row, never someone else's.
export function useWorkspace(workspaceSlug: string, user: AuthUser | null) {
  const userId = user?.id
  const dispatch = useAppDispatch()
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Remember the workspace's near-static identity (name, accent, timezone) so
  // the next visit — a refresh, or coming back to it — paints its real
  // accent immediately instead of flashing the default until the network
  // answers. A personal workspace is cached under its owner, not its slug: its
  // URL alias is identical for every user, so a slug key would let one
  // account's accent paint for the next account on this browser.
  const cacheIdentity = useCallback(
    (ws: Workspace) => {
      const identity = {
        id: ws.id,
        slug: ws.slug,
        name: ws.name,
        accent: ws.accent,
        timezone: ws.timezone,
      }
      if (ws.type !== 'personal') dispatch(upsertWorkspaceIdentity(identity))
      else if (userId)
        dispatch(upsertPersonalWorkspaceIdentity({ ownerId: userId, identity }))
    },
    [dispatch, userId],
  )

  useEffect(() => {
    if (!userId || !workspaceSlug) {
      setReady(true)
      return
    }
    let cancelled = false
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null
    let handleReconnect: (() => void) | null = null
    let handleVisibility: (() => void) | null = null

    const fetchMembers = (workspaceId: string) =>
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

    const loadWorkspaceRow = async () => {
      if (workspaceSlug !== PERSONAL_WORKSPACE_SLUG) {
        return supabase
          .from('workspaces')
          .select('*')
          .eq('slug', workspaceSlug)
          .single()
      }
      const personal = await supabase
        .from('workspaces')
        .select('*')
        .eq('type', 'personal')
        .eq('owner_id', userId)
        .maybeSingle()
      if (personal.data || personal.error) return personal
      // Every account gets one at signup; this only fills the gap for an
      // account whose signup-time provisioning didn't run. Idempotent.
      return supabase.rpc('ensure_personal_workspace').single()
    }

    loadWorkspaceRow().then(async workspaceResult => {
      if (cancelled) return
      if (workspaceResult.error || !workspaceResult.data) {
        setError(
          "Couldn't load this workspace — it may not exist, or you may not be a member.",
        )
        setReady(true)
        return
      }
      const loaded = rowToWorkspace(workspaceResult.data as WorkspaceRow)
      setWorkspace(loaded)
      cacheIdentity(loaded)

      await fetchMembers(loaded.id)
      if (cancelled) return
      setReady(true)

      // Realtime payloads carry only the raw row (no embedded profiles
      // join), so a member-joined/removed event just triggers a fresh
      // fetch of the full list rather than trying to merge a partial row.
      channel = supabase
        .channel(`workspace-members-${loaded.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'workspace_members',
            filter: `workspace_id=eq.${loaded.id}`,
          },
          () => {
            if (!cancelled) fetchMembers(loaded.id)
          },
        )
        .subscribe()

      handleReconnect = () => fetchMembers(loaded.id)
      handleVisibility = () => {
        if (document.visibilityState === 'visible' && handleReconnect)
          handleReconnect()
      }
      window.addEventListener('online', handleReconnect)
      document.addEventListener('visibilitychange', handleVisibility)
    })

    return () => {
      cancelled = true
      if (handleReconnect) window.removeEventListener('online', handleReconnect)
      if (handleVisibility)
        document.removeEventListener('visibilitychange', handleVisibility)
      if (channel) supabase.removeChannel(channel)
    }
  }, [userId, workspaceSlug, cacheIdentity])

  const role = members.find(member => member.userId === userId)?.role ?? null

  const updateWorkspace = async (
    patch: Partial<
      Pick<
        Workspace,
        'name' | 'description' | 'timezone' | 'reportTime' | 'accent'
      >
    >,
  ) => {
    if (!workspace) return { success: false as const, error: 'Not loaded.' }
    const supabase = createClient()
    const row: Record<string, string | null> = {}
    if (patch.name !== undefined) row.name = patch.name
    if (patch.description !== undefined) row.description = patch.description
    if (patch.timezone !== undefined) row.timezone = patch.timezone
    if (patch.reportTime !== undefined) row.report_time = patch.reportTime
    if (patch.accent !== undefined) row.accent = patch.accent
    const { error: updateError } = await supabase
      .from('workspaces')
      .update(row)
      .eq('id', workspace.id)
    if (updateError) {
      return { success: false as const, error: updateError.message }
    }
    const updated = { ...workspace, ...patch }
    setWorkspace(updated)
    cacheIdentity(updated)
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
