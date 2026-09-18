import { WorkspaceOverviewClient } from '@/components/workspaces/WorkspaceOverviewClient'

// Data-fetching for this page (tasks, activity, the Daily Report) lives in
// the client component below, not the shared layout -- it's specific to the
// overview and would be wasted work on the Members/Settings pages.
export default function WorkspaceOverviewPage() {
  return <WorkspaceOverviewClient />
}
