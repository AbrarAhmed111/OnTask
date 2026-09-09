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
  onRestart,
  onUpdateGoal,
  onReorder,
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
}) {
  const handleDrop = (event: React.DragEvent<HTMLElement>, toIndex: number) => {
    event.preventDefault()
    const fromIndex = Number(event.dataTransfer.getData('text/task-index'))
    onReorder(fromIndex, toIndex)
  }

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
          onRestart={() => onRestart(task)}
          onUpdateGoal={() => onUpdateGoal(task)}
          onDragStart={event => {
            event.dataTransfer.effectAllowed = 'move'
            event.dataTransfer.setData('text/task-index', String(index))
          }}
          onDragOver={event => event.preventDefault()}
          onDrop={event => handleDrop(event, index)}
        />
      ))}
    </div>
  )
}
