import type { SupabaseClient } from '@supabase/supabase-js'
import {
  CachedWorkspaceIdentity,
  toCachedWorkspaceIdentity,
} from '@/lib/redux/workspaceCacheSlice'
import {
  PERSONAL_WORKSPACE_SLUG,
  WorkspaceRow,
  rowToWorkspace,
} from '@/lib/workspaces'

// A workspace's identity (name, accent, timezone) as the SERVER sees it, for
// the workspace layout to hand to the client on the very first render.
//
// The client already paints from a localStorage cache, but that is empty on a
// browser that has never opened the workspace and stale after the accent is
// changed from another device, so either one painted the wrong accent until
// the client's own fetch came back. This runs under the visitor's own session
// (the cookie the middleware just refreshed), so row-level security decides
// what it can read: a workspace is visible only to its members, exactly as it
// is for the client's fetch, and nothing is exposed that the page wouldn't
// load anyway.
//
// It resolves the workspace the way useWorkspace does: `personal-workspace` is
// the same URL for every user and means "MY personal workspace", so it is found
// by the verified owner rather than by slug; anything else is found by slug.
//
// It is only a paint-first hint, never load-bearing: any failure -- signed out,
// not a member, no such workspace, network error -- yields undefined, and the
// client falls back to its cache and its own fetch, which report the real error.
export async function loadWorkspaceIdentity(
  supabase: SupabaseClient,
  slug: string,
): Promise<CachedWorkspaceIdentity | undefined> {
  try {
    const workspaces = supabase.from('workspaces').select('*')
    let result
    if (slug === PERSONAL_WORKSPACE_SLUG) {
      // getClaims() verifies the token's signature; the cookie's own `user`
      // object must not be trusted on the server.
      const { data } = await supabase.auth.getClaims()
      const ownerId = data?.claims.sub
      if (!ownerId) return undefined
      result = await workspaces
        .eq('type', 'personal')
        .eq('owner_id', ownerId)
        .maybeSingle()
    } else {
      result = await workspaces.eq('slug', slug).maybeSingle()
    }
    if (result.error || !result.data) return undefined
    return toCachedWorkspaceIdentity(
      rowToWorkspace(result.data as WorkspaceRow),
    )
  } catch {
    return undefined
  }
}
