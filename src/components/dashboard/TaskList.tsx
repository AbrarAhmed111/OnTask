import { Task } from '@/types'
import { TaskCard } from '@/components/dashboard/TaskCard'
import { ParentTaskCard } from '@/components/dashboard/ParentTaskCard'

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
  const rootTasks = tasks.filter(task => !task.parentTaskId)
  const childrenOf = (parentId: string) =>
    tasks.filter(task => task.parentTaskId === parentId)
  const moveOptions = rootTasks.map(task => ({ id: task.id, name: task.name }))

  const handleDrop = (event: React.DragEvent<HTMLElement>, toIndex: number) => {
    event.preventDefault()
    const fromIndex = Number(event.dataTransfer.getData('text/task-index'))
    onReorder(fromIndex, toIndex)
  }

  return (
    <div className="space-y-3">
      {rootTasks.map((task, index) => {
        const subtasks = childrenOf(task.id)
        if (subtasks.length > 0) {
          return (
            <ParentTaskCard
              key={task.id}
              parent={task}
              subtasks={subtasks}
              getWorkedSeconds={getWorkedSeconds}
              onStart={onStart}
              onPause={onPause}
              onFinish={onFinish}
              onEdit={onEdit}
              onDelete={onDelete}
              onRestart={onRestart}
              onUpdateGoal={onUpdateGoal}
              onAddSubtask={() => onAddSubtask(task.id)}
              onDeleteParent={() => onDeleteParent(task)}
              moveOptions={moveOptions.filter(option => option.id !== task.id)}
              onMoveTo={onMoveTo}
            />
          )
        }
        return (
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
            onAddSubtask={() => onAddSubtask(task.id)}
            moveOptions={moveOptions.filter(option => option.id !== task.id)}
            onMoveTo={parentId => onMoveTo(task.id, parentId)}
            onDragStart={event => {
              event.dataTransfer.effectAllowed = 'move'
              event.dataTransfer.setData('text/task-index', String(index))
            }}
            onDragOver={event => event.preventDefault()}
            onDrop={event => handleDrop(event, index)}
          />
        )
      })}
    </div>
  )
}
