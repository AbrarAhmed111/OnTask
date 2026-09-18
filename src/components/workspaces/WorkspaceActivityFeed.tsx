import { WorkspaceMember } from '@/types/workspace'
import { ActivityEvent } from '@/hooks/useWorkspaceActivity'

function describeEvent(event: ActivityEvent, actorName: string): string {
  const title = (event.metadata.title as string) || 'a task'
  const parentTitle = event.metadata.parent_title as string | undefined
  const under = parentTitle ? ` under "${parentTitle}"` : ''

  switch (event.eventType) {
    case 'created':
      return `${actorName} created "${title}"${under}`
    case 'edited':
      return `${actorName} updated "${title}"${under}`
    case 'started':
      return `${actorName} started "${title}"${under}`
    case 'paused':
      return `${actorName} paused "${title}"${under}`
    case 'resumed':
      return `${actorName} resumed "${title}"${under}`
    case 'completed':
      return `${actorName} completed "${title}"${under}`
    case 'skipped':
      return `${actorName} skipped "${title}"${under}`
    case 'reopened':
      return `${actorName} reopened "${title}"${under}`
    case 'deleted':
      return `${actorName} deleted "${title}"${under}`
    case 'assigned':
      return `${actorName} assigned "${title}"${under} to ${event.metadata.to}`
    case 'reassigned':
      return `${actorName} reassigned "${title}"${under} from ${event.metadata.from} to ${event.metadata.to}`
    case 'unassigned':
      return `${actorName} unassigned "${title}"${under}`
    case 'progress_changed':
      return event.metadata.to !== undefined
        ? `${actorName} updated progress on "${title}"${under} to ${event.metadata.to}%`
        : `${actorName} updated progress on "${title}"${under}`
    case 'parent_changed':
      return event.metadata.to === 'Standalone'
        ? `${actorName} made "${title}" standalone`
        : `${actorName} moved "${title}" under "${event.metadata.to}"`
    case 'member_invited':
      return `${actorName} invited ${event.metadata.invited_email}`
    case 'invitation_cancelled':
      return `${actorName} cancelled the invitation to ${event.metadata.invited_email}`
    case 'invitation_accepted':
      return `${actorName} accepted an invitation to join`
    case 'invitation_rejected':
      return `${actorName} declined an invitation to join`
    case 'member_joined':
      return `${actorName} joined the workspace`
    case 'member_removed':
      return event.metadata.self_removed
        ? `${actorName} left the workspace`
        : `${actorName} removed ${event.metadata.removed_display_name} from the workspace`
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
    <div className="max-h-[220px] divide-y divide-line/70 overflow-y-auto">
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
