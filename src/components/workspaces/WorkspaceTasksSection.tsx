import { CircleCheck, CirclePlus, Clock3, ListTodo, Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { WorkspaceTaskList } from '@/components/workspaces/WorkspaceTaskList'
import { WorkspaceMember, WorkspaceTask } from '@/types/workspace'

function StatCard({
  icon: Icon,
  label,
  value,
  valueClassName = 'text-ink',
}: {
  icon: typeof Clock3
  label: string
  value: number
  valueClassName?: string
}) {
  return (
    <div className="rounded-xl border border-line bg-panel px-4 py-3">
      <p className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-muted">
        <Icon size={12} /> {label}
      </p>
      <p className={`mt-1.5 text-lg font-bold ${valueClassName}`}>{value}</p>
    </div>
  )
}

function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-line bg-panel px-4 py-3">
      <Skeleton className="h-2.5 w-16" />
      <Skeleton className="mt-2 h-5 w-8" />
    </div>
  )
}

function TaskRowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-panel px-4 py-4 sm:px-5">
      <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1">
        <Skeleton className="h-3.5 w-1/3" />
        <Skeleton className="mt-2 h-2.5 w-1/4" />
      </div>
      <Skeleton className="h-7 w-16 shrink-0 rounded-lg" />
    </div>
  )
}

export function WorkspaceTasksSection({
  ready,
  stats,
  workingNow,
  tasks,
  members,
  queueTasks,
  completedTasks,
  getLiveSeconds,
  onAddTask,
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
  ready: boolean
  stats: {
    members: number
    working: number
    queued: number
    completedToday: number
  }
  workingNow: WorkspaceTask[]
  tasks: WorkspaceTask[]
  members: WorkspaceMember[]
  queueTasks: WorkspaceTask[]
  completedTasks: WorkspaceTask[]
  getLiveSeconds: (task: WorkspaceTask) => number
  onAddTask: () => void
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
  const parentOf = (task: WorkspaceTask) =>
    task.parentTaskId ? tasks.find(t => t.id === task.parentTaskId) : undefined

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {!ready ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard icon={Users} label="Members" value={stats.members} />
            <StatCard
              icon={Clock3}
              label="Working"
              value={stats.working}
              valueClassName="text-[var(--ws-accent,#375b4b)]"
            />
            <StatCard icon={ListTodo} label="Queued" value={stats.queued} />
            <StatCard
              icon={CircleCheck}
              label="Completed today"
              value={stats.completedToday}
            />
          </>
        )}
      </div>

      {ready && workingNow.length > 0 && (
        <div className="mb-6 rounded-2xl border border-sage/40 bg-sage/5 p-5 sm:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.1em] text-[var(--ws-accent,#375b4b)]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--ws-accent,#375b4b)] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--ws-accent,#375b4b)]" />
            </span>
            Working now
          </h2>
          <div className="space-y-2">
            {workingNow.map(task => {
              const assignee = members.find(m => m.userId === task.assignedTo)
              const parent = parentOf(task)
              return (
                <div
                  key={task.id}
                  className="flex items-center justify-between rounded-xl border border-line bg-panel px-4 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-ink">
                      {task.name}
                    </p>
                    {parent && (
                      <p className="truncate text-[10px] text-muted">
                        under &ldquo;{parent.name}&rdquo;
                      </p>
                    )}
                  </div>
                  <p className="shrink-0 text-[11px] text-muted">
                    {assignee?.fullName || assignee?.email || 'Someone'}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold tracking-tight text-ink">
            Queue{' '}
            {ready && (
              <span className="font-mono text-xs font-normal text-muted">
                {queueTasks.filter(task => !task.parentTaskId).length}
              </span>
            )}
          </h2>
          <Button onClick={onAddTask}>
            <CirclePlus size={15} /> Add task
          </Button>
        </div>
        {!ready ? (
          <div className="space-y-3">
            <TaskRowSkeleton />
            <TaskRowSkeleton />
            <TaskRowSkeleton />
          </div>
        ) : queueTasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-sage/70 px-5 py-10 text-center text-xs text-muted">
            {tasks.length === 0
              ? 'No tasks yet — add one to start planning together.'
              : 'Everything is done — nice work.'}
          </div>
        ) : (
          <WorkspaceTaskList
            tasks={queueTasks}
            members={members}
            getWorkedSeconds={getLiveSeconds}
            onStart={onStart}
            onPause={onPause}
            onFinish={onFinish}
            onEdit={onEdit}
            onDelete={onDelete}
            onReassign={onReassign}
            onReorder={onReorder}
            onAddSubtask={onAddSubtask}
            onDeleteParent={onDeleteParent}
            onMoveTo={onMoveTo}
          />
        )}
      </div>

      {ready && completedTasks.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-4 text-sm font-bold tracking-tight text-ink">
            Completed{' '}
            <span className="font-mono text-xs font-normal text-muted">
              {completedTasks.filter(task => !task.parentTaskId).length}
            </span>
          </h2>
          <WorkspaceTaskList
            tasks={completedTasks}
            members={members}
            getWorkedSeconds={getLiveSeconds}
            onStart={onStart}
            onPause={onPause}
            onFinish={onFinish}
            onEdit={onEdit}
            onDelete={onDelete}
            onReassign={onReassign}
            onReorder={() => {}}
            onAddSubtask={onAddSubtask}
            onDeleteParent={onDeleteParent}
            onMoveTo={onMoveTo}
          />
        </div>
      )}
    </div>
  )
}
