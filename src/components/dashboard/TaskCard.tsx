import { CirclePlus, Pause, Play, RotateCcw } from 'lucide-react'
import { Task } from '@/types'
import { Button } from '@/components/ui/Button'
import {
  TASK_CHIP_CLASS,
  TaskCardShell,
  TaskDragProps,
} from '@/components/tasks/TaskCardShell'
import {
  TaskMoveOption,
  TaskMoveSelect,
} from '@/components/tasks/TaskMoveSelect'

type TaskCardProps = {
  task: Task
  // Present only for root-level cards rendered by TaskList — drives both
  // the numbered badge and drag-to-reorder. Subtask rows rendered inside
  // ParentTaskCard omit these and get a plain dot indicator instead.
  index?: number
  workedSeconds: number
  onStart: () => void
  onPause: () => void
  onFinish: () => void
  onEdit: () => void
  onDelete: () => void
  onRestart: () => void
  onUpdateGoal: () => void
  drag?: TaskDragProps
  // Only root-level, childless cards can be promoted to a parent.
  onAddSubtask?: () => void
  // Only tasks eligible to move (childless) get this — either a subtask
  // moving to a different parent / going standalone, or a standalone task
  // becoming a subtask of an existing parent.
  moveOptions?: TaskMoveOption[]
  onMoveTo?: (parentId: string | null) => void
}

// A guest's local task. The card frame is shared with workspace tasks
// (TaskCardShell); what's specific to a local task lives here: its
// active/pending/paused statuses, restarting a finished one, and the
// standalone-or-subtask move picker.
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
  drag,
  onAddSubtask,
  moveOptions,
  onMoveTo,
}: TaskCardProps) {
  const completed = task.status === 'completed' || task.status === 'skipped'
  const active = task.status === 'active'
  const statusLabel = active
    ? 'In focus'
    : completed
      ? 'Complete'
      : task.status === 'paused'
        ? 'Paused'
        : 'Ready'

  return (
    <TaskCardShell
      title={task.name}
      index={index}
      tone={active ? 'running' : completed ? 'done' : 'idle'}
      statusLabel={statusLabel}
      focusLabel="Today's work"
      workedSeconds={workedSeconds}
      plannedMinutes={task.plannedMinutes}
      progressLabel={task.progressLabel}
      progressPercentage={task.progressPercentage}
      drag={drag}
      className={completed ? 'animate-[complete_420ms_ease-out]' : ''}
      onEdit={onEdit}
      onDelete={onDelete}
      leading={
        <>
          {onAddSubtask && (
            <button onClick={onAddSubtask} className={TASK_CHIP_CLASS}>
              <CirclePlus size={13} /> Subtask
            </button>
          )}
          {task.progressLabel && (
            <button onClick={onUpdateGoal} className={TASK_CHIP_CLASS}>
              Update progress
            </button>
          )}
          {onMoveTo && (
            <TaskMoveSelect
              taskName={task.name}
              parentTaskId={task.parentTaskId}
              options={moveOptions}
              onMove={onMoveTo}
            />
          )}
        </>
      }
      actions={
        <>
          {!completed && workedSeconds > 0 && (
            <button onClick={onFinish} className={TASK_CHIP_CLASS}>
              Finish early
            </button>
          )}
          {completed && (
            <button onClick={onRestart} className={TASK_CHIP_CLASS}>
              <RotateCcw size={13} /> Restart
            </button>
          )}
          {!completed && (
            <Button
              variant={active ? 'danger' : 'primary'}
              onClick={active ? onPause : onStart}
            >
              {active ? (
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
        </>
      }
    />
  )
}
