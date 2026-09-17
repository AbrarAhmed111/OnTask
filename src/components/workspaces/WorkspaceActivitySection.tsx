import { Activity } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import { WorkspaceActivityFeed } from '@/components/workspaces/WorkspaceActivityFeed'
import { ActivityEvent } from '@/hooks/useWorkspaceActivity'
import { WorkspaceMember } from '@/types/workspace'

function ActivityRowSkeleton() {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3">
      <Skeleton className="h-3 w-2/3" />
      <Skeleton className="h-2.5 w-10 shrink-0" />
    </div>
  )
}

export function WorkspaceActivitySection({
  ready,
  events,
  members,
}: {
  ready: boolean
  events: ActivityEvent[]
  members: WorkspaceMember[]
}) {
  return (
    <div className="rounded-2xl border border-line bg-panel shadow-sm">
      <div className="border-b border-line/70 px-5 py-4">
        <h2 className="flex items-center gap-2 text-sm font-bold tracking-tight text-ink">
          <Activity size={15} /> Activity
        </h2>
      </div>
      {!ready ? (
        <div className="divide-y divide-line/70">
          <ActivityRowSkeleton />
          <ActivityRowSkeleton />
          <ActivityRowSkeleton />
          <ActivityRowSkeleton />
        </div>
      ) : (
        <WorkspaceActivityFeed events={events} members={members} />
      )}
    </div>
  )
}
