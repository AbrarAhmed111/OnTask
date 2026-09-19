'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AuthUser } from '@/hooks/useAuth'
import { Workspace } from '@/types/workspace'
import { WorkspaceRow, rowToWorkspace } from '@/lib/workspaces'
import { useAppDispatch } from '@/lib/redux/hooks'
import {
  toCachedWorkspaceIdentity,
  upsertWorkspaceIdentities,
  upsertWorkspaceIdentity,
} from '@/lib/redux/workspaceCacheSlice'

// The workspace hub's data: the caller's SHARED workspaces (+ member counts)
// and create. The Personal Workspace deliberately isn't part of this list —
// it's always exactly one, always at the same URL, and never has members, so
// the hub renders it as its own fixed card instead of as a list entry.
// Only workspaces the caller has actually JOINED are listed. RLS alone isn't
// enough to guarantee that: an invitee can read a workspace they've merely been
// invited to (so the row must be filtered by real membership here), and an
// invitation is only ever shown in the invitations section until it's accepted.
// Detail data lives in useWorkspace.
//
// Every workspace listed here also has its identity (name, accent, timezone)
// written to the paint-first cache. The list already carries the accent, and
// without this a workspace opened for the first time from the hub -- or
// accepted from an invitation -- would paint the default accent until its own
// row loaded, and only then switch to the real one.
export function useWorkspaces(user: AuthUser | null) {
  const userId = user?.id
  const dispatch = useAppDispatch()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({})
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Bumped by reload() to re-run the fetch below (e.g. after accepting an
  // invitation adds a workspace to the list).
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!userId) {
      setWorkspaces([])
      setMemberCounts({})
      setReady(true)
      return
    }
    let cancelled = false
    const supabase = createClient()
    supabase
      .from('workspaces')
      // The inner-joined membership row is the filter: a workspace the user is
      // only invited to has no member row for them, so it drops out.
      .select('*, workspace_members!inner(user_id)')
      .eq('workspace_members.user_id', userId)
      .eq('type', 'shared')
      .order('created_at', { ascending: false })
      .then(async ({ data, error: fetchError }) => {
        if (cancelled) return
        if (fetchError) {
          setError("Couldn't load your workspaces.")
          setReady(true)
          return
        }
        setError(null)
        const rows = (data ?? []) as WorkspaceRow[]
        const loaded = rows.map(rowToWorkspace)
        setWorkspaces(loaded)
        dispatch(
          upsertWorkspaceIdentities(loaded.map(toCachedWorkspaceIdentity)),
        )
        setReady(true)
        if (rows.length === 0) {
          setMemberCounts({})
          return
        }

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
  }, [userId, reloadToken, dispatch])

  const reload = useCallback(() => setReloadToken(token => token + 1), [])

  const createWorkspace = async (
    name: string,
    description: string,
    timezone: string,
    reportTime: string = '12:00:00',
  ) => {
    if (!userId) return { success: false as const, error: 'Not signed in.' }
    const supabase = createClient()
    const { data, error: rpcError } = await supabase.rpc('create_workspace', {
      p_name: name,
      p_description: description.trim() || null,
      p_timezone: timezone,
      p_report_time: reportTime,
    })
    if (rpcError || !data) {
      return {
        success: false as const,
        error: rpcError?.message ?? 'Failed to create workspace.',
      }
    }
    const workspace = rowToWorkspace(data as WorkspaceRow)
    dispatch(upsertWorkspaceIdentity(toCachedWorkspaceIdentity(workspace)))
    setWorkspaces(current => [workspace, ...current])
    setMemberCounts(current => ({ ...current, [workspace.id]: 1 }))
    return { success: true as const, workspace }
  }

  return { workspaces, memberCounts, ready, error, createWorkspace, reload }
}
