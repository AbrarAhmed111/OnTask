import { ReactNode } from 'react'
import { WorkspaceLayoutClient } from '@/components/workspaces/WorkspaceLayoutClient'

// Server wrapper only to resolve Next 15's async `params` — this project is
// on React 18, so the client-side `use()` unwrapping pattern isn't
// available here. All real logic lives in the client component below. This
// layout is shared across /workspaces/[workspaceId] (overview),
// /members and /settings, so the workspace/member/invitation data it fetches
// survives navigating between those pages instead of being re-fetched on
// every tab switch.
export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ workspaceId: string }>
}) {
  const { workspaceId } = await params
  return (
    <WorkspaceLayoutClient workspaceId={workspaceId}>
      {children}
    </WorkspaceLayoutClient>
  )
}
