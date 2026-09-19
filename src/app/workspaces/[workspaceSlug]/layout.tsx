import { ReactNode } from 'react'
import { WorkspaceLayoutClient } from '@/components/workspaces/WorkspaceLayoutClient'
import { createClient } from '@/lib/supabase/server'
import { loadWorkspaceIdentity } from '@/lib/workspaceIdentity'

// The workspace's identity, read on the server so the very first client render
// already has the workspace's real accent -- on a browser that has never
// opened it, and after the accent was changed elsewhere, where the client's
// localStorage cache has nothing or something stale to paint.
async function loadInitialIdentity(workspaceSlug: string) {
  // The local-first dashboard can run without Supabase credentials (see
  // middleware.ts); there is nothing to read then.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    return undefined
  }
  try {
    return await loadWorkspaceIdentity(await createClient(), workspaceSlug)
  } catch {
    return undefined
  }
}

// Server wrapper: resolves Next 15's async `params` — this project is on
// React 18, so the client-side `use()` unwrapping pattern isn't available
// here — and the workspace's identity (above). All real logic lives in the
// client component below. This layout is shared across
// /workspaces/[workspaceSlug] (overview), /members and /settings, so the
// workspace/member/invitation data it fetches survives navigating between
// those pages instead of being re-fetched on every tab switch.
export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ workspaceSlug: string }>
}) {
  const { workspaceSlug } = await params
  const initialIdentity = await loadInitialIdentity(workspaceSlug)
  return (
    <WorkspaceLayoutClient
      workspaceSlug={workspaceSlug}
      initialIdentity={initialIdentity}
    >
      {children}
    </WorkspaceLayoutClient>
  )
}
