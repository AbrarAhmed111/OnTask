import { Task } from '@/types'
import { TaskCard } from '@/components/dashboard/TaskCard'
import { ParentTaskCard } from '@/components/dashboard/ParentTaskCard'
import { TaskTree } from '@/components/tasks/TaskTree'

export function TaskList({
  tasks,
  getWorkedSeconds,
  onStart,
  onPause,
  onFinish,
  onEdit,
  onDelete,
  onRestart,
  onUpdateGoal,
  onReorder,
  onAddSubtask,
  onDeleteParent,
  onMoveTo,
}: {
  tasks: Task[]
  getWorkedSeconds: (task: Task) => number
  onStart: (id: string) => void
  onPause: (task: Task) => void
  onFinish: (task: Task) => void
  onEdit: (task: Task) => void
  onDelete: (id: string) => void
  onRestart: (task: Task) => void
  onUpdateGoal: (task: Task) => void
  onReorder: (fromIndex: number, toIndex: number) => void
  onAddSubtask: (parentId: string) => void
  onDeleteParent: (task: Task) => void
  onMoveTo: (taskId: string, parentId: string | null) => void
}) {
  return (
    <TaskTree
      tasks={tasks}
      onReorder={onReorder}
      renderParent={(parent, subtasks, moveOptions) => (
        <ParentTaskCard
          parent={parent}
          subtasks={subtasks}
          getWorkedSeconds={getWorkedSeconds}
          onStart={onStart}
          onPause={onPause}
          onFinish={onFinish}
          onEdit={onEdit}
          onDelete={onDelete}
          onRestart={onRestart}
          onUpdateGoal={onUpdateGoal}
          onAddSubtask={() => onAddSubtask(parent.id)}
          onDeleteParent={() => onDeleteParent(parent)}
          moveOptions={moveOptions}
          onMoveTo={onMoveTo}
        />
      )}
      renderTask={(task, { index, moveOptions, drag }) => (
        <TaskCard
          task={task}
          index={index}
          workedSeconds={Math.round(getWorkedSeconds(task))}
          onStart={() => onStart(task.id)}
          onPause={() => onPause(task)}
          onFinish={() => onFinish(task)}
          onEdit={() => onEdit(task)}
          onDelete={() => onDelete(task.id)}
          onRestart={() => onRestart(task)}
          onUpdateGoal={() => onUpdateGoal(task)}
          onAddSubtask={() => onAddSubtask(task.id)}
          moveOptions={moveOptions}
          onMoveTo={parentId => onMoveTo(task.id, parentId)}
          drag={drag}
        />
      )}
    />
  )
}
