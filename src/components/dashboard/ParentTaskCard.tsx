'use client'

import { Task } from '@/types'
import { TaskCard } from '@/components/dashboard/TaskCard'
import { ParentTaskShell } from '@/components/tasks/ParentTaskShell'
import type { TaskMoveOption } from '@/components/tasks/TaskMoveSelect'

// A guest's local task that groups subtasks. The frame is shared with
// workspace goal tasks (ParentTaskShell); a local parent has no header
// extras of its own.
export function ParentTaskCard({
  parent,
  subtasks,
  getWorkedSeconds,
  onStart,
  onPause,
  onFinish,
  onEdit,
  onDelete,
  onRestart,
  onUpdateGoal,
  onAddSubtask,
  onDeleteParent,
  moveOptions,
  onMoveTo,
}: {
  parent: Task
  subtasks: Task[]
  getWorkedSeconds: (task: Task) => number
  onStart: (id: string) => void
  onPause: (task: Task) => void
  onFinish: (task: Task) => void
  onEdit: (task: Task) => void
  onDelete: (id: string) => void
  onRestart: (task: Task) => void
  onUpdateGoal: (task: Task) => void
  onAddSubtask: () => void
  onDeleteParent: () => void
  moveOptions: TaskMoveOption[]
  onMoveTo: (taskId: string, parentId: string | null) => void
}) {
  return (
    <ParentTaskShell
      title={parent.name}
      subtasks={subtasks}
      getWorkedSeconds={getWorkedSeconds}
      onAddSubtask={onAddSubtask}
      onDelete={onDeleteParent}
    >
      {subtasks.map(task => (
        <TaskCard
          key={task.id}
          task={task}
          workedSeconds={Math.round(getWorkedSeconds(task))}
          onStart={() => onStart(task.id)}
          onPause={() => onPause(task)}
          onFinish={() => onFinish(task)}
          onEdit={() => onEdit(task)}
          onDelete={() => onDelete(task.id)}
          onRestart={() => onRestart(task)}
          onUpdateGoal={() => onUpdateGoal(task)}
          moveOptions={moveOptions}
          onMoveTo={parentId => onMoveTo(task.id, parentId)}
        />
      ))}
    </ParentTaskShell>
  )
}
