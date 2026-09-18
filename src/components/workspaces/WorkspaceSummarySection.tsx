'use client'

import { useState } from 'react'
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  RefreshCw,
  Sparkles,
  UserPlus,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatMemberEvent } from '@/lib/workspaceSummaryEvents'
import { formatBoundary } from '@/lib/dailyReportWindow'
import { formatHM } from '@/lib/time'
import {
  StructuredSnapshotMember,
  StructuredSnapshotTaskActivity,
  StructuredSnapshotWorkspaceChanges,
  SummaryTaskStatus,
  WorkspaceDailySummary,
  WorkspaceMember,
} from '@/types/workspace'

// The report's own frozen report_timezone is used here (never the
// workspace's current timezone) so a historical report keeps displaying the
// window it was actually generated for, even after the workspace's timezone
// setting is later changed.
function formatWindow(summary: WorkspaceDailySummary): string {
  const start = formatBoundary(
    new Date(summary.reportStart),
    summary.reportTimezone,
  )
  const end = formatBoundary(
    new Date(summary.reportEnd),
    summary.reportTimezone,
  )
  return `${start} → ${end}`
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const STATUS_STYLE: Record<SummaryTaskStatus, string> = {
  completed: 'bg-sage/20 text-forest',
  in_progress:
    'bg-[var(--ws-accent-soft,#e9f0ec)] text-[var(--ws-accent,#375b4b)]',
  skipped: 'bg-coral/10 text-coral',
}

const STATUS_LABEL: Record<SummaryTaskStatus, string> = {
  completed: 'Completed',
  in_progress: 'In progress',
  skipped: 'Skipped',
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-coral/20 bg-coral/5 p-3 text-xs leading-5 text-coral">
      <AlertTriangle size={15} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  )
}

function TaskActivityRow({
  task,
  indented = false,
}: {
  task: StructuredSnapshotTaskActivity
  indented?: boolean
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 py-1.5 text-xs ${indented ? 'pl-5' : ''}`}
    >
      <span className="min-w-0 truncate text-ink">{task.title}</span>
      <span className="flex shrink-0 items-center gap-2">
        {task.progress_start !== null && task.progress_end !== null && (
          <span className="font-mono text-[10px] text-muted">
            {task.progress_start}%→{task.progress_end}%
          </span>
        )}
        <span className="font-mono text-[10px] text-muted">
          {formatHM(task.focused_seconds)}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${STATUS_STYLE[task.status_end]}`}
        >
          {STATUS_LABEL[task.status_end]}
        </span>
      </span>
    </div>
  )
}

function MemberBreakdown({
  member,
  note,
}: {
  member: StructuredSnapshotMember
  note?: string
}) {
  const taskById = new Map(member.task_activity.map(t => [t.task_id, t]))
  const topLevel = member.task_activity.filter(
    t => !t.parent_task_id || !taskById.has(t.parent_task_id),
  )

  return (
    <div className="rounded-xl border border-line/70 bg-paper/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold text-ink">{member.display_name}</p>
        <span className="font-mono text-[11px] font-semibold text-[var(--ws-accent,#375b4b)]">
          {formatHM(member.focused_seconds)}
        </span>
      </div>
      {note && <p className="mt-1.5 text-xs leading-5 text-muted">{note}</p>}

      {member.events.length > 0 && (
        <ul className="mt-2.5 list-disc space-y-1 border-t border-line/50 pl-5 pt-2.5 text-xs leading-5 text-ink">
          {member.events.map((event, i) => (
            <li key={i}>{formatMemberEvent(event)}</li>
          ))}
        </ul>
      )}

      {topLevel.length > 0 && (
        <div className="mt-2.5 divide-y divide-line/50 border-t border-line/50">
          {topLevel.map(task => (
            <div key={task.task_id}>
              <TaskActivityRow task={task} />
              {member.task_activity
                .filter(t => t.parent_task_id === task.task_id)
                .map(child => (
                  <TaskActivityRow key={child.task_id} task={child} indented />
                ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function WorkspaceChangesSection({
  changes,
  summaryText,
}: {
  changes: StructuredSnapshotWorkspaceChanges
  summaryText: string
}) {
  const items: string[] = []
  if (changes.tasks_created > 0)
    items.push(
      `${changes.tasks_created} task${changes.tasks_created === 1 ? '' : 's'} created`,
    )
  if (changes.tasks_completed > 0)
    items.push(
      `${changes.tasks_completed} task${changes.tasks_completed === 1 ? '' : 's'} completed`,
    )
  if (changes.tasks_skipped > 0)
    items.push(
      `${changes.tasks_skipped} task${changes.tasks_skipped === 1 ? '' : 's'} skipped`,
    )
  if (changes.tasks_deleted > 0)
    items.push(
      `${changes.tasks_deleted} task${changes.tasks_deleted === 1 ? '' : 's'} deleted`,
    )
  changes.members_joined.forEach(m => items.push(`${m.display_name} joined`))
  changes.members_removed.forEach(m => items.push(`${m.display_name} left`))
  changes.invitations.forEach(inv => {
    const statusText =
      inv.status === 'accepted'
        ? 'accepted'
        : inv.status === 'rejected'
          ? 'rejected'
          : inv.status === 'cancelled'
            ? 'cancelled'
            : 'still pending'
    items.push(
      `${inv.invited_by_name} invited ${inv.invited_email} (${statusText})`,
    )
  })

  if (items.length === 0) return null

  return (
    <div className="rounded-xl border border-line/70 bg-paper/60 p-4">
      <p className="flex items-center gap-1.5 text-xs font-bold text-ink">
        <UserPlus size={13} /> Workspace Changes
      </p>
      {summaryText && (
        <p className="mt-1.5 text-xs leading-5 text-muted">{summaryText}</p>
      )}
      <ul className="mt-2.5 list-disc space-y-1 border-t border-line/50 pl-5 pt-2.5 text-xs leading-5 text-ink">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

// Cross-member groupings by status — mechanically derived from task_activity,
// never AI output (see summary_service.py's SummaryNarrative docstring: this
// is exactly the kind of grouping that's 100% derivable from the snapshot,
// so it's computed here rather than risking the model re-deriving it).
function StatusRollup({
  title,
  entries,
}: {
  title: string
  entries: { title: string; memberName: string }[]
}) {
  if (entries.length === 0) return null
  return (
    <div className="rounded-xl border border-line/70 bg-paper/60 p-4">
      <p className="text-xs font-bold text-ink">
        {title} <span className="font-mono text-muted">{entries.length}</span>
      </p>
      <ul className="mt-2.5 space-y-1 border-t border-line/50 pt-2.5 text-xs leading-5">
        {entries.map((entry, i) => (
          <li key={i} className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate text-ink">{entry.title}</span>
            <span className="shrink-0 text-muted">{entry.memberName}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function WorkspaceSummarySection({
  ready,
  error,
  summary,
  members,
  nextReportLabel,
  reportTimeLabel,
  generating,
  onRegenerate,
}: {
  ready: boolean
  error?: string | null
  summary: WorkspaceDailySummary | null
  members: WorkspaceMember[]
  nextReportLabel: string | null
  reportTimeLabel: string
  generating: boolean
  onRegenerate: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const isPending = summary?.generationStatus === 'pending'
  const isFailed = summary?.generationStatus === 'failed'
  const isCompleted = summary?.generationStatus === 'completed'
  const hasNoRecordedActivity =
    isCompleted && summary.structuredSnapshot.members.length === 0

  const regeneratedByMember = summary?.regeneratedBy
    ? members.find(m => m.userId === summary.regeneratedBy)
    : null
  const regeneratedByName =
    regeneratedByMember?.fullName || regeneratedByMember?.email || 'A member'

  const byStatus = (status: SummaryTaskStatus) =>
    summary
      ? summary.structuredSnapshot.members.flatMap(member =>
          member.task_activity
            .filter(task => task.status_end === status)
            .map(task => ({
              title: task.title,
              memberName: member.display_name,
            })),
        )
      : []

  return (
    <div className="rounded-2xl border border-line bg-panel shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-line/70 px-5 py-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold tracking-tight text-ink">
            <Sparkles size={15} /> Daily Report
          </h2>
          {summary ? (
            <p className="mt-1 flex items-center gap-1 text-[11px] leading-4 text-muted">
              <Clock size={11} className="shrink-0" />
              Previous 24 hours · {formatWindow(summary)}
            </p>
          ) : (
            <p className="mt-1 text-[11px] leading-4 text-muted">
              Automatically generated every day at {reportTimeLabel}, covering
              your workspace&apos;s previous 24 hours.
            </p>
          )}
        </div>
        {isCompleted && !hasNoRecordedActivity && (
          <button
            onClick={() => setExpanded(current => !current)}
            className="flex items-center gap-1 text-[11px] font-semibold text-[var(--ws-accent,#375b4b)] transition hover:text-coral"
          >
            {expanded ? 'Hide' : 'View Report'}
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        )}
      </div>

      {!ready ? (
        <div className="space-y-3 px-5 py-4">
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-8 w-40" />
        </div>
      ) : !summary ? (
        <div className="px-5 py-8 text-center">
          <p className="text-xs leading-5 text-muted">
            {nextReportLabel
              ? `Next report: ${nextReportLabel}`
              : 'The Daily Report is generated automatically once your workspace has activity to cover.'}
          </p>
        </div>
      ) : isPending ? (
        <div className="flex items-center justify-center gap-2 px-5 py-8 text-center">
          <Loader2 size={14} className="animate-spin text-muted" />
          <p className="text-xs leading-5 text-muted">
            Generating your workspace&apos;s Daily Report…
          </p>
        </div>
      ) : isFailed ? (
        <div className="flex flex-col items-center gap-3 px-5 py-8 text-center">
          <ErrorBanner message="Daily Report couldn't be generated yet." />
          <Button onClick={onRegenerate} disabled={generating}>
            {generating ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            Retry
          </Button>
        </div>
      ) : hasNoRecordedActivity ? (
        <div className="px-5 py-8 text-center">
          <p className="text-xs leading-5 text-muted">
            {summary.narrative.overall_summary}
          </p>
        </div>
      ) : (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <p className="text-xs text-muted">
              <span className="font-mono text-sm font-bold text-ink">
                {formatHM(summary.structuredSnapshot.total_focused_seconds)}
              </span>{' '}
              recorded · {summary.structuredSnapshot.members.length}{' '}
              {summary.structuredSnapshot.members.length === 1
                ? 'member'
                : 'members'}
            </p>
            <Button
              variant="ghost"
              onClick={onRegenerate}
              disabled={generating}
            >
              {generating ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <RefreshCw size={13} />
              )}
              Regenerate
            </Button>
          </div>

          {error && (
            <div className="px-5 pb-4">
              <ErrorBanner message={error} />
            </div>
          )}

          {expanded && (
            <div className="space-y-4 border-t border-line/70 px-5 py-4">
              <p className="text-xs leading-6 text-ink">
                {summary.narrative.overall_summary}
              </p>

              {summary.narrative.highlights.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-xs leading-5 text-muted">
                  {summary.narrative.highlights.map((highlight, i) => (
                    <li key={i}>{highlight}</li>
                  ))}
                </ul>
              )}

              <div className="space-y-3">
                {summary.structuredSnapshot.members.map(member => (
                  <MemberBreakdown
                    key={member.user_id}
                    member={member}
                    note={
                      summary.narrative.members.find(
                        n => n.user_id === member.user_id,
                      )?.note
                    }
                  />
                ))}
              </div>

              <WorkspaceChangesSection
                changes={summary.structuredSnapshot.workspace_changes}
                summaryText={summary.narrative.workspace_changes_summary}
              />

              <StatusRollup
                title="Completed Work"
                entries={byStatus('completed')}
              />
              <StatusRollup
                title="Still In Progress"
                entries={byStatus('in_progress')}
              />
              <StatusRollup
                title="Skipped Work"
                entries={byStatus('skipped')}
              />

              {summary.meta.used_fallback_template && (
                <p className="text-[10px] leading-4 text-muted">
                  AI narration wasn&apos;t available for this report — the
                  totals above are computed directly from tracked time.
                </p>
              )}

              <p className="text-[10px] text-muted">
                {summary.regeneratedAt
                  ? `Last regenerated by ${regeneratedByName} · ${formatTimestamp(summary.regeneratedAt)}`
                  : `Automatically generated at ${formatTimestamp(summary.generatedAt)}`}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
