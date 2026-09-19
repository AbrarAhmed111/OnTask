import {
  SummaryCurrentStatus,
  WorkspaceStructuredSnapshot,
} from '@/types/workspace'

// The exact numbers a Daily Report shows, taken straight from the snapshot the
// backend computed -- never from the AI narrative, which is asked to describe
// what happened in words and to state none of them.
export type DailyReportMetrics = {
  focusedSeconds: number
  // Distinct tasks completed in the period that are still completed at its end.
  tasksCompleted: number
  // Members with any recorded activity (only meaningful for a shared workspace).
  activeMembers: number
}

// A task's state at the end of the period. `current_status` is authoritative;
// a snapshot from before migration 0042 only has the coarser `status_end`, so
// the two are folded into one vocabulary here (its "in progress" stays a
// distinct, honest "in_progress" rather than being guessed as working/paused).
export type ReportTaskStatus = SummaryCurrentStatus | 'in_progress'

export function reportTaskStatus(task: {
  current_status?: SummaryCurrentStatus | null
  status_end: 'completed' | 'in_progress' | 'skipped'
}): ReportTaskStatus {
  return task.current_status ?? task.status_end
}

export function getDailyReportMetrics(
  snapshot: WorkspaceStructuredSnapshot,
): DailyReportMetrics {
  let tasksCompleted = snapshot.metrics?.tasks_completed
  if (tasksCompleted === undefined) {
    // An older snapshot: count distinct tasks that ended completed.
    const completed = new Set<string>()
    for (const member of snapshot.members) {
      for (const task of member.task_activity) {
        if (reportTaskStatus(task) === 'completed') completed.add(task.task_id)
      }
    }
    tasksCompleted = completed.size
  }
  return {
    focusedSeconds: snapshot.total_focused_seconds,
    tasksCompleted,
    activeMembers: snapshot.members.filter(
      member =>
        member.focused_seconds > 0 ||
        member.events.length > 0 ||
        member.task_activity.length > 0,
    ).length,
  }
}

export function hasReportActivity(
  snapshot: WorkspaceStructuredSnapshot,
): boolean {
  const changes = snapshot.workspace_changes
  return (
    snapshot.total_focused_seconds > 0 ||
    snapshot.members.some(
      member => member.events.length > 0 || member.task_activity.length > 0,
    ) ||
    (snapshot.blockers?.length ?? 0) > 0 ||
    changes.invitations.length > 0 ||
    changes.members_joined.length > 0 ||
    changes.members_removed.length > 0 ||
    changes.tasks_created > 0 ||
    changes.tasks_completed > 0 ||
    changes.tasks_skipped > 0 ||
    changes.tasks_deleted > 0
  )
}

// The narrative as the paragraphs it was written in. New reports carry all of
// their prose in `overall_summary`, paragraphs separated by a blank line; an
// older one is a single paragraph, and its per-member notes and bullet
// highlights are deliberately not shown (the report is a narrative, not a list).
export function narrativeParagraphs(narrative: {
  overall_summary: string
}): string[] {
  return narrative.overall_summary
    .split(/\n{2,}/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean)
}
