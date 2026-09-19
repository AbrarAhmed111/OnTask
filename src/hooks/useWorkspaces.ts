'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AuthUser } from '@/hooks/useAuth'
import { WorkspaceRow, rowToWorkspace } from '@/lib/workspaces'
import { useAppDispatch } from '@/lib/redux/hooks'
import {
  toCachedWorkspaceIdentity,
  upsertWorkspaceIdentities,
  upsertWorkspaceIdentity,
} from '@/lib/redux/workspaceCacheSlice'
import { cacheThenRevalidate } from '@/lib/cache/cacheThenRevalidate'
import {
  WorkspaceListSnapshot,
  getCachedWorkspaceList,
  saveWorkspaceList,
} from '@/lib/cache/workspaceListCache'

// What is on screen, stamped with the account it belongs to. The hook only ever
// returns it when that account is the signed-in one (derived while rendering,
// not reset in an effect), so switching accounts can never show the previous
// account's workspaces -- not even for a frame.
type ListState = WorkspaceListSnapshot & { ownerId: string | null }

const NOBODY: ListState = { ownerId: null, workspaces: [], memberCounts: {} }

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
//
// The list is also cached on this device (IndexedDB, see lib/cache) and shown
// from there on a repeat visit while the real list is fetched in the
// background; the fetched list then replaces it wholesale, so a workspace the
// user has since lost access to disappears. The cache only makes the first
// paint sooner -- it never decides who belongs to what.
export function useWorkspaces(user: AuthUser | null) {
  const userId = user?.id ?? null
  const dispatch = useAppDispatch()
  const [list, setList] = useState<ListState>(NOBODY)
  // The latest list, for code that must merge into it rather than into the
  // snapshot it closed over (the effect below, and createWorkspace).
  const listRef = useRef<ListState>(NOBODY)
  const [readyFor, setReadyFor] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Bumped by reload() to re-run the fetch below (e.g. after accepting an
  // invitation adds a workspace to the list).
  const [reloadToken, setReloadToken] = useState(0)

  const commit = useCallback((next: ListState) => {
    listRef.current = next
    setList(next)
  }, [])

  const visible = list.ownerId === userId ? list : NOBODY
  // Nothing to load for a signed-out visitor, so that counts as ready. For a
  // signed-in one it is ready once *their* list (cached or fetched) is in.
  const ready = !userId || readyFor === userId

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    const supabase = createClient()
    const showing = () => listRef.current.ownerId === userId

    void cacheThenRevalidate<WorkspaceListSnapshot>({
      read: () => getCachedWorkspaceList(userId),
      fetchFresh: async emit => {
        const { data, error: fetchError } = await supabase
          .from('workspaces')
          // The inner-joined membership row is the filter: a workspace the user
          // is only invited to has no member row for them, so it drops out.
          .select('*, workspace_members!inner(user_id)')
          .eq('workspace_members.user_id', userId)
          .eq('type', 'shared')
          .order('created_at', { ascending: false })
        if (fetchError) throw fetchError

        const rows = (data ?? []) as WorkspaceRow[]
        const workspaces = rows.map(rowToWorkspace)
        if (!cancelled) {
          dispatch(
            upsertWorkspaceIdentities(
              workspaces.map(toCachedWorkspaceIdentity),
            ),
          )
        }
        if (rows.length === 0) return { workspaces, memberCounts: {} }

        // The counts need the ids above, so they can only come one query
        // later. Show the workspaces now -- with whatever counts are already on
        // screen, so they don't blank out and pop back -- rather than holding
        // the whole list for them.
        emit({
          workspaces,
          memberCounts: showing() ? listRef.current.memberCounts : {},
        })
        const { data: members } = await supabase
          .from('workspace_members')
          .select('workspace_id')
          .in(
            'workspace_id',
            rows.map(row => row.id),
          )
        const memberCounts: Record<string, number> = {}
        ;(members ?? []).forEach(member => {
          const key = (member as { workspace_id: string }).workspace_id
          memberCounts[key] = (memberCounts[key] ?? 0) + 1
        })
        return { workspaces, memberCounts }
      },
      write: snapshot => saveWorkspaceList(userId, snapshot),
      isCancelled: () => cancelled,
      onCached: hit => {
        // Only a head start: anything already on screen for this user (a
        // reload, or a create) is at least as new as what was stored.
        if (showing()) return
        commit({ ownerId: userId, ...hit.data })
        setReadyFor(userId)
      },
      onFresh: snapshot => {
        setError(null)
        commit({ ownerId: userId, ...snapshot })
        setReadyFor(userId)
      },
      onError: (_fetchError, { hadCache }) => {
        // With something on screen, say so honestly instead of implying the
        // list is current; the page keeps showing it.
        setError(
          hadCache || showing()
            ? "Couldn't refresh your workspaces — you may be seeing an out-of-date list."
            : "Couldn't load your workspaces.",
        )
        setReadyFor(userId)
      },
    })
    return () => {
      cancelled = true
    }
  }, [userId, reloadToken, dispatch, commit])

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
    // Merged into the latest list (not the one this call started with), which
    // a background refresh may have replaced while the RPC was in flight. The
    // server has confirmed the create, so the cache follows the screen.
    const base =
      listRef.current.ownerId === userId ? listRef.current : { ...NOBODY }
    const next: ListState = {
      ownerId: userId,
      workspaces: [
        workspace,
        ...base.workspaces.filter(existing => existing.id !== workspace.id),
      ],
      memberCounts: { ...base.memberCounts, [workspace.id]: 1 },
    }
    commit(next)
    void saveWorkspaceList(userId, next)
    return { success: true as const, workspace }
  }

  return {
    workspaces: visible.workspaces,
    memberCounts: visible.memberCounts,
    ready,
    error,
    createWorkspace,
    reload,
  }
}
