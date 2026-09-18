import {
  Check,
  CirclePlus,
  GripVertical,
  Pause,
  Pencil,
  Play,
  Trash2,
} from 'lucide-react'
import { WorkspaceMember, WorkspaceTask } from '@/types/workspace'
import { formatPlanned, formatTime } from '@/lib/time'
import { Button } from '@/components/ui/Button'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { AssigneePicker } from '@/components/workspaces/AssigneePicker'
import { GoalProgress } from '@/components/goals/GoalProgress'

export function WorkspaceTaskCard({
  task,
  index,
  workedSeconds,
  members,
  onStart,
  onPause,
  onFinish,
  onEdit,
  onDelete,
  onAddSubtask,
  onReassign,
  moveOptions,
  onMoveTo,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  task: WorkspaceTask
  index?: number
  workedSeconds: number
  members: WorkspaceMember[]
  onStart: () => void
  onPause: () => void
  onFinish: () => void
  onEdit: () => void
  onDelete: () => void
  onAddSubtask?: () => void
  onReassign: (userId: string | null) => void
  moveOptions?: { id: string; name: string }[]
  onMoveTo?: (parentId: string | null) => void
  onDragStart?: (event: React.DragEvent<HTMLElement>) => void
  onDragOver?: (event: React.DragEvent<HTMLElement>) => void
  onDrop?: (event: React.DragEvent<HTMLElement>) => void
}) {
  const completed = task.status === 'completed' || task.status === 'skipped'
  const draggable = index !== undefined && Boolean(onDragStart)
  const taskProgress = Math.min(
    100,
    (workedSeconds / (task.plannedMinutes * 60)) * 100,
  )
  const statusLabel =
    task.status === 'working'
      ? 'In focus'
      : completed
        ? task.status === 'skipped'
          ? 'Skipped'
          : 'Complete'
        : task.status === 'paused'
          ? 'Paused'
          : 'Queued'
  const assignee = members.find(member => member.userId === task.assignedTo)
  const ghostChip =
    'inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1.5 text-[10px] font-semibold text-muted transition hover:border-[var(--ws-accent,#375b4b)] hover:text-[var(--ws-accent,#375b4b)]'

  return (
    <article
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`group rounded-2xl border bg-panel shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md ${task.status === 'working' ? 'border-sage shadow-sage/10' : 'border-line'} ${completed ? 'bg-slate-50/70' : ''}`}
    >
      <div className="flex items-center gap-3 px-4 py-4 sm:px-5">
        {draggable && (
          <button
            type="button"
            aria-label={`Reorder ${task.name}`}
            className="cursor-grab touch-none rounded-lg p-1 text-muted transition hover:bg-slate-100 hover:text-ink active:cursor-grabbing"
            title="Drag to reorder"
          >
            <GripVertical size={16} />
          </button>
        )}
        <div
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border font-mono text-[10px] ${completed ? 'border-coral bg-coral text-white' : task.status === 'working' ? 'border-[var(--ws-accent,#375b4b)] bg-[var(--ws-accent,#375b4b)] text-white' : 'border-sage text-[var(--ws-accent,#375b4b)]'}`}
        >
          {completed ? (
            <Check size={15} />
          ) : index !== undefined ? (
            String(index + 1).padStart(2, '0')
          ) : (
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
          )}
        </div>
        <h3 className="min-w-0 truncate text-sm font-bold tracking-tight text-ink">
          {task.name}
        </h3>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 font-mono text-[9px] uppercase ${task.status === 'working' ? 'bg-[var(--ws-accent-soft,#e9f0ec)] text-[var(--ws-accent,#375b4b)]' : completed ? 'bg-coral/10 text-coral' : 'bg-slate-100 text-muted'}`}
        >
          {statusLabel}
        </span>
        <button
          aria-label={`Edit ${task.name}`}
          onClick={onEdit}
          className="ml-auto shrink-0 rounded-lg p-2 text-muted transition hover:bg-slate-100 hover:text-ink"
        >
          <Pencil size={15} />
        </button>
      </div>

      <div className="space-y-4 px-4 pb-5 sm:px-5 sm:pl-[68px]">
        <div>
          <div className="flex items-end justify-between gap-4">
            <div>
              <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-muted">
                Focused time
              </span>
              <strong className="mt-1.5 block text-2xl font-bold tracking-tight text-ink">
                {formatTime(workedSeconds)}{' '}
                <small className="text-xs font-medium text-muted">
                  / {formatPlanned(task.plannedMinutes)}
                </small>
              </strong>
            </div>
            <span className="shrink-0 rounded-full bg-[var(--ws-accent-soft,#e9f0ec)] px-2.5 py-1 font-mono text-[11px] font-bold text-[var(--ws-accent,#375b4b)]">
              {Math.round(taskProgress)}%
            </span>
          </div>
          <ProgressBar
            value={taskProgress}
            tone="coral"
            className="mt-3 h-1.5"
          />
        </div>

        {task.goalName && (
          <GoalProgress
            name={task.goalName}
            progress={task.goalProgress || 0}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/70 px-4 py-3 sm:px-5 sm:pl-[68px]">
        <div className="flex flex-wrap items-center gap-2">
          <AssigneePicker
            assignee={assignee}
            members={members}
            onReassign={onReassign}
          />
          {onMoveTo && (
            <select
              aria-label={`Move ${task.name}`}
              value={task.parentTaskId ?? ''}
              onChange={event => onMoveTo(event.target.value || null)}
              className="rounded-full border border-line bg-white/70 px-2.5 py-1.5 text-[10px] font-semibold text-muted outline-none transition hover:border-[var(--ws-accent,#375b4b)] focus:border-sage"
            >
              <option value="">Standalone</option>
              {moveOptions?.map(option => (
                <option key={option.id} value={option.id}>
                  Move to &quot;{option.name}&quot;
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {onAddSubtask && (
            <button onClick={onAddSubtask} className={ghostChip}>
              <CirclePlus size={13} /> Subtask
            </button>
          )}
          {!completed && (
            <button onClick={onFinish} className={ghostChip}>
              Finish
            </button>
          )}
          {!completed && (
            <Button
              variant={task.status === 'working' ? 'danger' : 'primary'}
              onClick={task.status === 'working' ? onPause : onStart}
            >
              {task.status === 'working' ? (
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
          <span className="mx-0.5 h-5 w-px shrink-0 bg-line" />
          <button
            aria-label={`Delete ${task.name}`}
            onClick={onDelete}
            className="shrink-0 rounded-lg p-2 text-muted transition hover:bg-coral/10 hover:text-coral"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </article>
  )
}
