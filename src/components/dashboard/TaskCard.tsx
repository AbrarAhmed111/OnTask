import {
  Check,
  GripVertical,
  Pause,
  Pencil,
  Play,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { Task } from '@/types'
import { formatPlanned, formatTime } from '@/lib/time'
import { Button } from '@/components/ui/Button'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { GoalProgress } from '@/components/goals/GoalProgress'

type TaskCardProps = {
  task: Task
  index: number
  workedSeconds: number
  onStart: () => void
  onPause: () => void
  onFinish: () => void
  onEdit: () => void
  onDelete: () => void
  onRestart: () => void
  onUpdateGoal: () => void
  onDragStart: (event: React.DragEvent<HTMLElement>) => void
  onDragOver: (event: React.DragEvent<HTMLElement>) => void
  onDrop: (event: React.DragEvent<HTMLElement>) => void
}

export function TaskCard({
  task,
  index,
  workedSeconds,
  onStart,
  onPause,
  onFinish,
  onEdit,
  onDelete,
  onRestart,
  onUpdateGoal,
  onDragStart,
  onDragOver,
  onDrop,
}: TaskCardProps) {
  const completed = task.status === 'completed' || task.status === 'skipped'
  const taskProgress = Math.min(
    100,
    (workedSeconds / (task.plannedMinutes * 60)) * 100,
  )
  const statusLabel =
    task.status === 'active'
      ? 'In focus'
      : completed
        ? 'Complete'
        : task.status === 'paused'
          ? 'Paused'
          : 'Ready'
  return (
    <article
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`group rounded-2xl border bg-panel shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md ${task.status === 'active' ? 'border-sage shadow-sage/10' : 'border-line'} ${completed ? 'animate-[complete_420ms_ease-out] bg-slate-50/70' : ''}`}
    >
      <div className="flex items-center gap-3 border-b border-line/70 px-4 py-4 sm:px-5">
        <button
          type="button"
          aria-label={`Reorder ${task.name}`}
          className="cursor-grab touch-none rounded-lg p-1 text-muted transition hover:bg-slate-100 hover:text-ink active:cursor-grabbing"
          title="Drag to reorder"
        >
          <GripVertical size={16} />
        </button>
        <div
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border font-mono text-[10px] ${completed ? 'border-coral bg-coral text-white' : task.status === 'active' ? 'border-forest bg-forest text-white' : 'border-sage text-forest'}`}
        >
          {completed ? <Check size={15} /> : String(index + 1).padStart(2, '0')}
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold tracking-tight text-ink">
            {task.name}
          </h3>
          <p className="mt-1 text-[10px] text-muted">
            {task.goalName || 'Personal focus session'}
          </p>
        </div>
        <span
          className={`ml-auto rounded-full px-2.5 py-1 font-mono text-[9px] uppercase ${task.status === 'active' ? 'bg-sage/20 text-forest' : completed ? 'bg-coral/10 text-coral' : 'bg-slate-100 text-muted'}`}
        >
          {statusLabel}
        </span>
        <button
          aria-label={`Edit ${task.name}`}
          onClick={onEdit}
          className="rounded-lg p-2 text-muted transition hover:bg-slate-100 hover:text-ink"
        >
          <Pencil size={15} />
        </button>
      </div>
      <div className="grid gap-6 px-4 py-5 sm:grid-cols-[1fr_1fr_auto] sm:px-5 sm:pl-[68px]">
        <div>
          <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-muted">
            Today&apos;s work
          </span>
          <strong className="mt-1.5 block text-lg font-bold tracking-tight text-ink">
            {formatTime(workedSeconds)}{' '}
            <small className="text-[11px] font-medium text-muted">
              / {formatPlanned(task.plannedMinutes)}
            </small>
          </strong>
          <ProgressBar value={taskProgress} tone="coral" className="mt-3 h-1" />
        </div>
        {task.goalName && (
          <GoalProgress
            name={task.goalName}
            progress={task.goalProgress || 0}
          />
        )}
        <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
          {!completed && (
            <Button
              variant={task.status === 'active' ? 'danger' : 'primary'}
              onClick={task.status === 'active' ? onPause : onStart}
            >
              {task.status === 'active' ? (
                <>
                  <Pause size={15} /> Pause
                </>
              ) : (
                <>
                  <Play size={15} />{' '}
                  {task.status === 'paused' ? 'Resume' : 'Start'}
                </>
              )}
            </Button>
          )}
          {!completed && workedSeconds > 0 && (
            <button
              onClick={onFinish}
              className="text-[10px] font-semibold text-forest transition hover:text-coral"
            >
              Finish early
            </button>
          )}
          {task.goalName && (
            <button
              onClick={onUpdateGoal}
              className="text-[10px] font-semibold text-forest transition hover:text-coral"
            >
              Update goal
            </button>
          )}
          {completed && (
            <>
              <button
                onClick={onRestart}
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-forest transition hover:text-coral"
              >
                <RotateCcw size={14} /> Restart
              </button>
              <button
                aria-label={`Delete ${task.name}`}
                onClick={onDelete}
                className="rounded-lg p-2 text-muted transition hover:bg-coral/10 hover:text-coral"
              >
                <Trash2 size={15} />
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  )
}
