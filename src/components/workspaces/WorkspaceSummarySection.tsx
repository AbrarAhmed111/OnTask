'use client'

import { useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import {
  StructuredSnapshotMember,
  StructuredSnapshotTask,
  SummaryTaskStatus,
  WorkspaceDailySummary,
  WorkspaceMember,
} from '@/types/workspace'

function formatHM(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.round((totalSeconds % 3600) / 60)
  return `${hours}h ${minutes}m`
}

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(
    undefined,
    {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    },
  )
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

function TaskRow({
  task,
  indented = false,
}: {
  task: StructuredSnapshotTask
  indented?: boolean
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 py-1.5 text-xs ${indented ? 'pl-5' : ''}`}
    >
      <span className="min-w-0 truncate text-ink">{task.name}</span>
      <span className="flex shrink-0 items-center gap-2">
        <span className="font-mono text-[10px] text-muted">
          {formatHM(task.focused_seconds)}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${STATUS_STYLE[task.status]}`}
        >
          {STATUS_LABEL[task.status]}
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
  const taskById = new Map(member.tasks.map(t => [t.task_id, t]))
  const topLevel = member.tasks.filter(
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
      <div className="mt-2.5 divide-y divide-line/50 border-t border-line/50">
        {topLevel.map(task => (
          <div key={task.task_id}>
            <TaskRow task={task} />
            {member.tasks
              .filter(t => t.parent_task_id === task.task_id)
              .map(child => (
                <TaskRow key={child.task_id} task={child} indented />
              ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function WorkspaceSummarySection({
  ready,
  summary,
  members,
  summaryDate,
  generating,
  onGenerate,
  onRegenerate,
}: {
  ready: boolean
  summary: WorkspaceDailySummary | null
  members: WorkspaceMember[]
  summaryDate: string | null
  generating: boolean
  onGenerate: () => void
  onRegenerate: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  const generatedByMember = summary
    ? members.find(m => m.userId === summary.generatedBy)
    : null
  const generatedByName =
    generatedByMember?.fullName || generatedByMember?.email || 'A member'

  return (
    <div className="rounded-2xl border border-line bg-panel shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-line/70 px-5 py-4">
        <h2 className="flex items-center gap-2 text-sm font-bold tracking-tight text-ink">
          <Sparkles size={15} /> Yesterday&apos;s Work
        </h2>
        {summary && (
          <button
            onClick={() => setExpanded(current => !current)}
            className="flex items-center gap-1 text-[11px] font-semibold text-[var(--ws-accent,#375b4b)] transition hover:text-coral"
          >
            {expanded ? 'Hide' : 'View Summary'}
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
        <div className="flex flex-col items-center gap-3 px-5 py-8 text-center">
          <p className="text-xs leading-5 text-muted">
            {summaryDate
              ? `No AI summary yet for ${formatDate(summaryDate)}.`
              : 'No activity to summarize yet.'}
          </p>
          <Button onClick={onGenerate} disabled={generating}>
            {generating ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} />
            )}
            Generate AI Summary
          </Button>
        </div>
      ) : (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <p className="text-xs text-muted">
              <span className="font-mono text-sm font-bold text-ink">
                {formatHM(summary.structuredSnapshot.total_focused_seconds)}
              </span>{' '}
              recorded on {formatDate(summary.summaryDate)} ·{' '}
              {summary.structuredSnapshot.members.length}{' '}
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
                      summary.narrative.member_notes.find(
                        n => n.user_id === member.user_id,
                      )?.note
                    }
                  />
                ))}
              </div>

              {summary.meta.used_fallback_template && (
                <p className="text-[10px] leading-4 text-muted">
                  AI narration wasn&apos;t available for this summary — the
                  totals above are computed directly from tracked time.
                </p>
              )}

              <p className="text-[10px] text-muted">
                {summary.version > 1 ? 'Last regenerated' : 'Generated'} by{' '}
                {generatedByName} · {formatTimestamp(summary.generatedAt)}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
