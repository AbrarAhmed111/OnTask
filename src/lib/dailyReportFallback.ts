import { formatHM } from '@/lib/time'
import {
  StructuredSnapshotMember,
  StructuredSnapshotWorkspaceChanges,
  SummaryGenerationMeta,
  SummaryMemberNarrative,
  SummaryNarrative,
  WorkspaceStructuredSnapshot,
} from '@/types/workspace'

// A deterministic, non-AI narrative built directly from an already-computed
// StructuredSnapshot -- used ONLY when the call to ontask-llm itself fails
// (network error, timeout, non-2xx response). ontask-llm's own
// summary_service.py never raises for a provider/validation failure -- it
// always returns a 200 with its own deterministic fallback narrative in that
// case -- so this is strictly for "we couldn't even reach/parse the AI
// service", not "the AI's narrative failed validation". Mirrors
// _fallback_narrative/_fallback_workspace_changes_summary in
// ontask-llm/src/app/services/summary_service.py field-for-field, so a
// report looks the same regardless of which side produced the fallback.
// Deliberately never persists a report without a real, already-computed
// snapshot: the whole point is that AI narration can fail without the
// factual report failing.

function hasActivity(snapshot: WorkspaceStructuredSnapshot): boolean {
  const changes = snapshot.workspace_changes
  return (
    snapshot.total_focused_seconds > 0 ||
    snapshot.members.some(
      m => m.events.length > 0 || m.task_activity.length > 0,
    ) ||
    changes.invitations.length > 0 ||
    changes.members_joined.length > 0 ||
    changes.members_removed.length > 0 ||
    changes.tasks_created > 0 ||
    changes.tasks_completed > 0 ||
    changes.tasks_skipped > 0 ||
    changes.tasks_deleted > 0
  )
}

function fallbackWorkspaceChangesSummary(
  changes: StructuredSnapshotWorkspaceChanges,
): string {
  const bits: string[] = []
  if (changes.invitations.length > 0)
    bits.push(`${changes.invitations.length} invitation(s) sent or updated`)
  if (changes.members_joined.length > 0)
    bits.push(`${changes.members_joined.length} member(s) joined`)
  if (changes.members_removed.length > 0)
    bits.push(`${changes.members_removed.length} member(s) left`)
  if (changes.tasks_created > 0)
    bits.push(`${changes.tasks_created} task(s) created`)
  if (changes.tasks_completed > 0)
    bits.push(`${changes.tasks_completed} task(s) completed`)
  if (changes.tasks_skipped > 0)
    bits.push(`${changes.tasks_skipped} task(s) skipped`)
  if (changes.tasks_deleted > 0)
    bits.push(`${changes.tasks_deleted} task(s) deleted`)
  return bits.length > 0 ? `${bits.join(', ')}.` : ''
}

function fallbackMemberNote(member: StructuredSnapshotMember): string {
  if (member.task_activity.length > 0) {
    const completed = member.task_activity.filter(
      t => t.status_end === 'completed',
    ).length
    return (
      `${member.display_name} focused ${formatHM(member.focused_seconds)} across ` +
      `${member.task_activity.length} task${member.task_activity.length !== 1 ? 's' : ''}, ` +
      `${completed} completed.`
    )
  }
  if (member.events.length > 0) {
    return (
      `${member.display_name} recorded ${member.events.length} ` +
      `activity item${member.events.length !== 1 ? 's' : ''}, no focused time logged.`
    )
  }
  return `${member.display_name} had no recorded task activity.`
}

export function buildFallbackNarrative(
  snapshot: WorkspaceStructuredSnapshot,
): SummaryNarrative {
  if (!hasActivity(snapshot)) {
    return {
      overall_summary:
        'No significant workspace activity was recorded during the previous 24 hours.',
      members: [],
      workspace_changes_summary: '',
      highlights: [],
    }
  }

  const activeMembers = snapshot.members.filter(
    m =>
      m.focused_seconds > 0 ||
      m.events.length > 0 ||
      m.task_activity.length > 0,
  )

  const overallSummary =
    snapshot.total_focused_seconds > 0
      ? `${activeMembers.length} member${activeMembers.length !== 1 ? 's' : ''} were active, ` +
        `logging ${formatHM(snapshot.total_focused_seconds)} of focused work during the ` +
        `previous 24 hours.`
      : `${activeMembers.length} member${activeMembers.length !== 1 ? 's' : ''} had recorded ` +
        `activity during the previous 24 hours, with no focused time logged.`

  const members: SummaryMemberNarrative[] = activeMembers.map(member => ({
    user_id: member.user_id,
    note: fallbackMemberNote(member),
  }))

  return {
    overall_summary: overallSummary,
    members,
    workspace_changes_summary: fallbackWorkspaceChangesSummary(
      snapshot.workspace_changes,
    ),
    highlights: [],
  }
}

/** `meta` for a report whose narrative was produced by `buildFallbackNarrative` above,
 * because the AI service itself could not be reached -- distinct from ontask-llm's own
 * `used_fallback_template` (AI reachable, narrative rejected by validation). */
export function buildUnreachableFallbackMeta(
  reason: string,
): SummaryGenerationMeta {
  return {
    provider: 'none',
    model: 'rule_based',
    generated_at: new Date().toISOString(),
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    status_events: [],
    used_fallback_template: true,
    validation_warnings: [`AI summary service unreachable: ${reason}`],
  }
}
