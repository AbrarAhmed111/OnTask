import { WorkspaceMember, WorkspaceTask } from '@/types/workspace'
import { WorkspaceTaskCard } from '@/components/workspaces/WorkspaceTaskCard'
import { WorkspaceParentTaskCard } from '@/components/workspaces/WorkspaceParentTaskCard'
import type { AuthUser } from '@/hooks/useAuth'

// Renders a flat task list, or a Task -> Subtask tree when some tasks carry
// a parentTaskId (only possible inside a Goal — see
// supabase/migrations/0021_workspace_goals.sql). Reused as-is for both the
// permanently-flat workspace overview list and a single Goal's task tree;
// which one it's rendering falls out of whether any task in `tasks` has a
// parentTaskId, and whether the hierarchy-management callbacks are passed.
export function WorkspaceTaskList({
  tasks,
  members,
  user,
  getWorkedSeconds,
  onStart,
  onPause,
  onEmergencyStop,
  onFinish,
  onEdit,
  onDelete,
  onReassign,
  onReorder,
  onAddSubtask,
  onDeleteParent,
  onMoveTo,
  getBlockedBy,
  onManageDependencies,
}: {
  tasks: WorkspaceTask[]
  members: WorkspaceMember[]
  user: AuthUser | null
  getWorkedSeconds: (task: WorkspaceTask) => number
  onStart: (id: string) => void
  onPause: (task: WorkspaceTask) => void
  onEmergencyStop?: (task: WorkspaceTask) => void
  onFinish: (task: WorkspaceTask) => void
  onEdit: (task: WorkspaceTask) => void
  onDelete: (id: string) => void
  onReassign: (id: string, userId: string | null) => void
  onReorder: (fromIndex: number, toIndex: number) => void
  onAddSubtask?: (parentId: string) => void
  onDeleteParent?: (task: WorkspaceTask) => void
  onMoveTo?: (taskId: string, parentId: string | null) => void
  // Goal-scoped only (see GoalCard) — a flat list never passes these.
  getBlockedBy?: (task: WorkspaceTask) => string[]
  onManageDependencies?: (task: WorkspaceTask) => void
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
              user={user}
              getWorkedSeconds={getWorkedSeconds}
              onStart={onStart}
              onPause={onPause}
              onEmergencyStop={onEmergencyStop}
              onFinish={onFinish}
              onEdit={onEdit}
              onDelete={onDelete}
              onReassign={onReassign}
              onAddSubtask={() => onAddSubtask?.(task.id)}
              onDeleteParent={() => onDeleteParent?.(task)}
              moveOptions={moveOptions.filter(option => option.id !== task.id)}
              onMoveTo={(taskId, parentId) => onMoveTo?.(taskId, parentId)}
              getBlockedBy={getBlockedBy}
              onManageDependencies={onManageDependencies}
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
            user={user}
            onStart={() => onStart(task.id)}
            onPause={() => onPause(task)}
            onEmergencyStop={
              onEmergencyStop ? () => onEmergencyStop(task) : undefined
            }
            onFinish={() => onFinish(task)}
            onEdit={() => onEdit(task)}
            onDelete={() => onDelete(task.id)}
            onReassign={userId => onReassign(task.id, userId)}
            onAddSubtask={
              onAddSubtask ? () => onAddSubtask(task.id) : undefined
            }
            moveOptions={
              onMoveTo
                ? moveOptions.filter(option => option.id !== task.id)
                : undefined
            }
            onMoveTo={
              onMoveTo ? parentId => onMoveTo(task.id, parentId) : undefined
            }
            blockedBy={getBlockedBy?.(task)}
            onManageDependencies={
              onManageDependencies
                ? () => onManageDependencies(task)
                : undefined
            }
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
