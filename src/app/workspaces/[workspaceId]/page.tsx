import { WorkspaceDetailClient } from '@/components/workspaces/WorkspaceDetailClient'

// Server wrapper only to resolve Next 15's async `params` — this project is
// on React 18, so the client-side `use()` unwrapping pattern isn't
// available here. All real logic lives in the client component below.
export default async function WorkspaceDetailPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>
}) {
  const { workspaceId } = await params
  return <WorkspaceDetailClient workspaceId={workspaceId} />
}
