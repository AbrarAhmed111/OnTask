import { StructuredSnapshotEvent } from '@/types/workspace'

// Deterministic, template-based rendering of one raw activity event into a
// short factual sentence — NOT AI-generated. The AI narrative (SummaryNarrative)
// only ever supplies the flowing prose alongside these; every bullet a member
// sees here is derived directly from the structured snapshot, so there's zero
// hallucination risk on the enumerable facts (what was created/assigned/
// completed/...). Mirrors ontask-llm's SYSTEM_PROMPT instructions for how the
// AI itself should read these same events, just rendered deterministically
// instead of narrated.
export function formatMemberEvent(event: StructuredSnapshotEvent): string {
  const title = event.task_title ?? 'a task'
  const meta = event.metadata ?? {}
  const str = (key: string) => {
    const value = meta[key]
    return typeof value === 'string' && value.length > 0 ? value : undefined
  }
  const num = (key: string) => {
    const value = meta[key]
    return typeof value === 'number' ? value : undefined
  }
  const withParent = (text: string) =>
    event.parent_title ? `${text} under "${event.parent_title}"` : text

  switch (event.type) {
    case 'created':
      return withParent(`Created "${title}"`)
    case 'edited':
      return withParent(`Updated "${title}"`)
    case 'deleted':
      return withParent(`Deleted "${title}"`)
    case 'assigned':
      return withParent(`Assigned "${title}" to ${str('to') ?? 'a member'}`)
    case 'reassigned':
      return withParent(
        `Reassigned "${title}" from ${str('from') ?? 'someone'} to ${str('to') ?? 'a member'}`,
      )
    case 'unassigned':
      return withParent(`Unassigned "${title}"`)
    case 'started':
      return withParent(`Started working on "${title}"`)
    case 'paused':
      if (str('reason') === 'emergency_stop')
        return withParent(
          `Stopped ${str('stopped_user_name') ?? 'a member'}'s timer on "${title}"`,
        )
      if (str('reason') === 'reassigned')
        return withParent(
          `Timer on "${title}" stopped because it was reassigned`,
        )
      return withParent(`Paused "${title}"`)
    case 'resumed':
      return withParent(`Resumed working on "${title}"`)
    case 'completed':
      return withParent(`Completed "${title}"`)
    case 'skipped':
      return withParent(`Skipped "${title}"`)
    case 'reopened':
      return withParent(`Reopened "${title}"`)
    case 'progress_changed': {
      const from = num('from')
      const to = num('to')
      if (from !== undefined && to !== undefined) {
        return withParent(
          `Updated progress on "${title}" from ${from}% to ${to}%`,
        )
      }
      if (to !== undefined) {
        return withParent(`Updated progress on "${title}" to ${to}%`)
      }
      return withParent(`Updated progress on "${title}"`)
    }
    // Task blockers. The reason and note are the members' own words, shown
    // as written — never rephrased.
    case 'task_blocker_added': {
      const reason = str('reason')
      return withParent(
        reason ? `Blocked "${title}" — ${reason}` : `Blocked "${title}"`,
      )
    }
    case 'task_blocker_mention':
      return withParent(
        `Mentioned ${str('mentioned_name') ?? 'a member'} in the blocker for "${title}"`,
      )
    case 'task_blocker_updated':
      return withParent(`Updated the blocker on "${title}"`)
    case 'task_blocker_resolved': {
      const note = str('resolution_note')
      return withParent(
        note
          ? `Resolved the blocker on "${title}" — ${note}`
          : `Resolved the blocker on "${title}"`,
      )
    }
    case 'parent_changed': {
      const to = str('to')
      return to && to !== 'Standalone'
        ? `Moved "${title}" under "${to}"`
        : `Made "${title}" standalone`
    }
    case 'invitation_sent': {
      const email = str('invited_email') ?? 'someone'
      const status = str('status')
      const statusText =
        status === 'accepted'
          ? `${email} accepted the invitation`
          : status === 'rejected'
            ? 'the invitation was rejected'
            : status === 'cancelled'
              ? 'the invitation was cancelled'
              : 'the invitation is still pending'
      return `Invited ${email}; ${statusText}`
    }
    default:
      return withParent(title)
  }
}
