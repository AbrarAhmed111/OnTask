import { Task } from '@/types'
import { TaskCard } from '@/components/dashboard/TaskCard'

export function TaskList({
  tasks,
  getWorkedSeconds,
  onStart,
  onPause,
  onFinish,
  onEdit,
  onDelete,
  onUpdateGoal,
}: {
  tasks: Task[]
  getWorkedSeconds: (task: Task) => number
  onStart: (id: string) => void
  onPause: (task: Task) => void
  onFinish: (task: Task) => void
  onEdit: (task: Task) => void
  onDelete: (id: string) => void
  onUpdateGoal: (task: Task) => void
}) {
  return (
    <div className="space-y-3">
      {tasks.map((task, index) => (
        <TaskCard
          key={task.id}
          task={task}
          index={index}
          workedSeconds={Math.round(getWorkedSeconds(task))}
          onStart={() => onStart(task.id)}
          onPause={() => onPause(task)}
          onFinish={() => onFinish(task)}
          onEdit={() => onEdit(task)}
          onDelete={() => onDelete(task.id)}
          onUpdateGoal={() => onUpdateGoal(task)}
        />
      ))}
    </div>
  )
}
