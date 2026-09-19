import {
  Archive,
  CalendarDays,
  CircleCheck,
  Pencil,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { formatTime } from '@/lib/time'
import { Goal } from '@/types/workspace'

export function GoalDetailHeader({
  goal,
  progress,
  focusedSeconds,
  totalTasks,
  completedTasks,
  blockedTasks,
  onEdit,
  onMarkComplete,
  onArchive,
  onReactivate,
  onDelete,
}: {
  goal: Goal
  progress: number
  focusedSeconds: number
  totalTasks: number
  completedTasks: number
  blockedTasks: number
  onEdit: () => void
  onMarkComplete: () => void
  onArchive: () => void
  onReactivate: () => void
  onDelete?: () => void
}) {
  return (
    <div className="rounded-2xl border border-line bg-panel p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-extrabold tracking-tight text-ink">
            {goal.name}
          </h1>
          {goal.description && (
            <p className="mt-1.5 max-w-xl text-xs leading-5 text-muted">
              {goal.description}
            </p>
          )}
          {goal.targetDate && (
            <p className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold text-muted">
              <CalendarDays size={12} />
              Target{' '}
              {new Date(goal.targetDate).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            aria-label="Edit goal"
            onClick={onEdit}
            className="rounded-lg p-2 text-muted transition hover:bg-slate-100 hover:text-ink"
          >
            <Pencil size={15} />
          </button>
          {goal.status === 'active' && (
            <Button variant="secondary" onClick={onMarkComplete}>
              <CircleCheck size={15} /> Mark complete
            </Button>
          )}
          {goal.status !== 'archived' ? (
            <Button variant="ghost" onClick={onArchive}>
              <Archive size={15} /> Archive
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={onReactivate}>
                <RotateCcw size={15} /> Reactivate
              </Button>
              {onDelete && (
                <Button
                  variant="danger"
                  onClick={onDelete}
                  aria-label="Delete goal"
                  className="gap-1.5"
                >
                  <Trash2 size={15} /> Delete
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-line bg-white/60 px-4 py-3">
          <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted">
            Progress
          </p>
          <p className="mt-1.5 text-lg font-bold text-ink">{progress}%</p>
          <ProgressBar value={progress} tone="sage" className="mt-2 h-1.5" />
        </div>
        <div className="rounded-xl border border-line bg-white/60 px-4 py-3">
          <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted">
            Focused time
          </p>
          <p className="mt-1.5 text-lg font-bold text-ink">
            {formatTime(focusedSeconds, true)}
          </p>
        </div>
        <div className="rounded-xl border border-line bg-white/60 px-4 py-3">
          <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted">
            Tasks
          </p>
          <p className="mt-1.5 text-lg font-bold text-ink">{totalTasks}</p>
        </div>
        <div className="rounded-xl border border-line bg-white/60 px-4 py-3">
          <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted">
            Completed
          </p>
          <p className="mt-1.5 text-lg font-bold text-[var(--ws-accent,#375b4b)]">
            {completedTasks}
          </p>
        </div>
      </div>
      {blockedTasks > 0 && (
        <p className="mt-3 text-[11px] font-semibold text-coral">
          {blockedTasks} {blockedTasks === 1 ? 'task is' : 'tasks are'} blocked
          by an incomplete dependency.
        </p>
      )}
    </div>
  )
}
