import { WorkspaceMember } from '@/types/workspace'
import { ActivityEvent } from '@/hooks/useWorkspaceActivity'

function describeEvent(event: ActivityEvent, actorName: string): string {
  const title = (event.metadata.title as string) || 'a task'
  const parentTitle = event.metadata.parent_title as string | undefined
  const under = parentTitle ? ` under "${parentTitle}"` : ''

  switch (event.eventType) {
    case 'created':
      return `${actorName} created "${title}"${under}`
    case 'started':
      return `${actorName} started "${title}"${under}`
    case 'paused':
      return `${actorName} paused "${title}"${under}`
    case 'completed':
      return `${actorName} completed "${title}"${under}`
    case 'skipped':
      return `${actorName} skipped "${title}"${under}`
    case 'deleted':
      return `${actorName} deleted "${title}"${under}`
    case 'assigned':
      return `${actorName} assigned "${title}"${under} to ${event.metadata.to}`
    case 'reassigned':
      return `${actorName} reassigned "${title}"${under} from ${event.metadata.from} to ${event.metadata.to}`
    case 'parent_changed':
      return event.metadata.to === 'Standalone'
        ? `${actorName} made "${title}" standalone`
        : `${actorName} moved "${title}" under "${event.metadata.to}"`
    default:
      return `${actorName} updated "${title}"${under}`
  }
}

function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

// Renders task_events as plain sentences with parent context preserved —
// "Iqra started 'Dashboard UI' under 'School Management MVP'" — never just
// a bare task name once it has a parent.
export function WorkspaceActivityFeed({
  events,
  members,
}: {
  events: ActivityEvent[]
  members: WorkspaceMember[]
}) {
  if (events.length === 0) {
    return (
      <p className="px-5 py-6 text-center text-xs text-muted">
        No activity yet.
      </p>
    )
  }
  return (
    <div className="divide-y divide-line/70">
      {events.map(event => {
        const actor = members.find(member => member.userId === event.actorId)
        const actorName = actor?.fullName || actor?.email || 'Someone'
        return (
          <div
            key={event.id}
            className="flex items-center justify-between gap-3 px-5 py-3"
          >
            <p className="text-xs leading-5 text-ink">
              {describeEvent(event, actorName)}
            </p>
            <span className="shrink-0 text-[10px] text-muted">
              {timeAgo(event.createdAt)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
