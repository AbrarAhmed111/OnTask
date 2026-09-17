import { WorkspaceMember, WorkspaceTask } from '@/types/workspace'
import { WorkspaceTaskCard } from '@/components/workspaces/WorkspaceTaskCard'
import { WorkspaceParentTaskCard } from '@/components/workspaces/WorkspaceParentTaskCard'

export function WorkspaceTaskList({
  tasks,
  members,
  getWorkedSeconds,
  onStart,
  onPause,
  onFinish,
  onEdit,
  onDelete,
  onReassign,
  onReorder,
  onAddSubtask,
  onDeleteParent,
  onMoveTo,
}: {
  tasks: WorkspaceTask[]
  members: WorkspaceMember[]
  getWorkedSeconds: (task: WorkspaceTask) => number
  onStart: (id: string) => void
  onPause: (task: WorkspaceTask) => void
  onFinish: (task: WorkspaceTask) => void
  onEdit: (task: WorkspaceTask) => void
  onDelete: (id: string) => void
  onReassign: (id: string, userId: string | null) => void
  onReorder: (fromIndex: number, toIndex: number) => void
  onAddSubtask: (parentId: string) => void
  onDeleteParent: (task: WorkspaceTask) => void
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
            <WorkspaceParentTaskCard
              key={task.id}
              parent={task}
              subtasks={subtasks}
              members={members}
              getWorkedSeconds={getWorkedSeconds}
              onStart={onStart}
              onPause={onPause}
              onFinish={onFinish}
              onEdit={onEdit}
              onDelete={onDelete}
              onReassign={onReassign}
              onAddSubtask={() => onAddSubtask(task.id)}
              onDeleteParent={() => onDeleteParent(task)}
              moveOptions={moveOptions.filter(option => option.id !== task.id)}
              onMoveTo={onMoveTo}
            />
          )
        }
        return (
          <WorkspaceTaskCard
            key={task.id}
            task={task}
            index={index}
            workedSeconds={Math.round(getWorkedSeconds(task))}
            members={members}
            onStart={() => onStart(task.id)}
            onPause={() => onPause(task)}
            onFinish={() => onFinish(task)}
            onEdit={() => onEdit(task)}
            onDelete={() => onDelete(task.id)}
            onReassign={userId => onReassign(task.id, userId)}
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
