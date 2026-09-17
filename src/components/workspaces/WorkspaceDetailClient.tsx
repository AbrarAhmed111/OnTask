'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Activity,
  ArrowLeft,
  CircleCheck,
  CirclePlus,
  Clock3,
  ListTodo,
  LogOut,
  Mail,
  Settings2,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { WorkspacePageShell } from '@/components/layout/WorkspacePageShell'
import { EditWorkspaceModal } from '@/components/workspaces/EditWorkspaceModal'
import { InviteMemberModal } from '@/components/workspaces/InviteMemberModal'
import { WorkspaceTaskList } from '@/components/workspaces/WorkspaceTaskList'
import { WorkspaceTaskForm } from '@/components/workspaces/WorkspaceTaskForm'
import { WorkspaceActivityFeed } from '@/components/workspaces/WorkspaceActivityFeed'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { DeleteParentModal } from '@/components/tasks/DeleteParentModal'
import { CompletionModal } from '@/components/tasks/CompletionModal'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useWorkspace } from '@/hooks/useWorkspace'
import { useWorkspaceInvitations } from '@/hooks/useWorkspaceInvitations'
import { useWorkspaceTasks } from '@/hooks/useWorkspaceTasks'
import { useWorkspaceActivity } from '@/hooks/useWorkspaceActivity'
import type { AuthUser } from '@/hooks/useAuth'
import { WorkspaceMember, WorkspaceTask } from '@/types/workspace'
import { TaskFormValues } from '@/types'

const emptyTaskForm: TaskFormValues = {
  name: '',
  hours: '1',
  minutes: '0',
  goal: '',
  progress: '0',
  trackGoal: false,
}

const INVITATION_STATUS_STYLE: Record<string, string> = {
  pending: 'bg-sage/20 text-forest',
  accepted: 'bg-sage/20 text-forest',
  rejected: 'bg-coral/10 text-coral',
  expired: 'bg-slate-100 text-muted',
  cancelled: 'bg-slate-100 text-muted',
}

export function WorkspaceDetailClient({
  workspaceId,
}: {
  workspaceId: string
}) {
  return (
    <WorkspacePageShell>
      {({ user }) => <WorkspaceDetail workspaceId={workspaceId} user={user} />}
    </WorkspacePageShell>
  )
}

type PendingAction =
  | { type: 'remove'; member: WorkspaceMember }
  | { type: 'leave' }
  | { type: 'delete-parent'; task: WorkspaceTask; childCount: number }

function WorkspaceDetail({
  workspaceId,
  user,
}: {
  workspaceId: string
  user: AuthUser
}) {
  const router = useRouter()
  const {
    workspace,
    members,
    role,
    ready,
    error,
    updateWorkspace,
    removeMember,
  } = useWorkspace(workspaceId, user)
  const { invitations, inviteByEmail, cancelInvitation } =
    useWorkspaceInvitations(workspaceId, user)
  const [completionTask, setCompletionTask] = useState<WorkspaceTask | null>(
    null,
  )
  const {
    tasks,
    ready: tasksReady,
    error: tasksError,
    startTask,
    pauseTask,
    finishTask,
    addTask,
    updateTask,
    deleteTask,
    moveTask,
    reassignTask,
    reorderTasks,
    getLiveSeconds,
  } = useWorkspaceTasks(workspaceId, user, members, task =>
    setCompletionTask(task),
  )
  const { events: activityEvents } = useWorkspaceActivity(workspaceId, user)
  const [editing, setEditing] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [taskModal, setTaskModal] = useState<'add' | 'edit' | null>(null)
  const [taskForm, setTaskForm] = useState<TaskFormValues>(emptyTaskForm)
  const [taskAssignee, setTaskAssignee] = useState('')
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [pendingParentId, setPendingParentId] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (tasksError) setNotice(tasksError)
  }, [tasksError])

  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(''), 5000)
    return () => window.clearTimeout(timeout)
  }, [notice])

  if (!ready) return null

  if (error || !workspace) {
    return (
      <div className="rounded-2xl border border-coral/20 bg-coral/5 p-6 text-center">
        <p className="text-sm font-semibold text-coral">
          {error || 'Workspace not found.'}
        </p>
        <Link
          href="/workspaces"
          className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-forest hover:text-coral"
        >
          <ArrowLeft size={14} /> Back to Shared Workspaces
        </Link>
      </div>
    )
  }

  const isOwner = role === 'owner'
  const parentOf = (task: WorkspaceTask) =>
    task.parentTaskId ? tasks.find(t => t.id === task.parentTaskId) : undefined
  const workingNow = tasks.filter(task => task.status === 'working')

  const isDone = (task: WorkspaceTask) =>
    task.status === 'completed' || task.status === 'skipped'
  const rootTasks = tasks.filter(task => !task.parentTaskId)
  const rootIsDone = (root: WorkspaceTask) => {
    const children = tasks.filter(task => task.parentTaskId === root.id)
    return children.length > 0 ? children.every(isDone) : isDone(root)
  }
  const queueRootIds = new Set(
    rootTasks.filter(root => !rootIsDone(root)).map(root => root.id),
  )
  const completedRootIds = new Set(
    rootTasks.filter(root => rootIsDone(root)).map(root => root.id),
  )
  const queueTasks = tasks.filter(task =>
    queueRootIds.has(task.parentTaskId ?? task.id),
  )
  const completedTasks = tasks.filter(task =>
    completedRootIds.has(task.parentTaskId ?? task.id),
  )

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const stats = {
    members: members.length,
    working: tasks.filter(task => task.status === 'working').length,
    queued: tasks.filter(task => task.status === 'queued').length,
    completedToday: tasks.filter(
      task =>
        task.status === 'completed' &&
        task.completedAt !== null &&
        task.completedAt >= startOfToday.getTime(),
    ).length,
  }

  const confirmRemove = async () => {
    if (pendingAction?.type !== 'remove') return
    const result = await removeMember(pendingAction.member.userId)
    setPendingAction(null)
    setNotice(
      result.success
        ? `${pendingAction.member.fullName || pendingAction.member.email || 'Member'} removed from the workspace.`
        : result.error || 'Failed to remove member.',
    )
  }

  const confirmLeave = async () => {
    const result = await removeMember(user.id)
    setPendingAction(null)
    if (result.success) {
      router.push('/workspaces')
      return
    }
    setNotice(result.error || 'Failed to leave workspace.')
  }

  const closeTaskModal = () => {
    setTaskModal(null)
    setEditingTaskId(null)
    setPendingParentId(null)
  }
  const openAddTask = () => {
    setTaskForm({ ...emptyTaskForm })
    setTaskAssignee('')
    setPendingParentId(null)
    setTaskModal('add')
  }
  const openAddSubtask = (parentId: string) => {
    setTaskForm({ ...emptyTaskForm })
    setTaskAssignee('')
    setPendingParentId(parentId)
    setTaskModal('add')
  }
  const openEditTask = (task: WorkspaceTask) => {
    setEditingTaskId(task.id)
    setTaskForm({
      name: task.name,
      hours: String(Math.floor(task.plannedMinutes / 60)),
      minutes: String(task.plannedMinutes % 60),
      goal: task.goalName || '',
      progress: String(task.goalProgress || 0),
      trackGoal: Boolean(task.goalName),
    })
    setTaskAssignee(task.assignedTo ?? '')
    setTaskModal('edit')
  }

  const handleAddTask = (event: FormEvent) => {
    if (addTask(event, taskForm, pendingParentId, taskAssignee || null)) {
      closeTaskModal()
      setNotice(pendingParentId ? 'Subtask added.' : 'Task added.')
    }
  }
  const handleEditTask = (event: FormEvent) => {
    event.preventDefault()
    if (!editingTaskId) return
    const plannedMinutes =
      Number(taskForm.hours || 0) * 60 + Number(taskForm.minutes || 0)
    if (!taskForm.name.trim() || plannedMinutes <= 0) return
    updateTask(editingTaskId, {
      name: taskForm.name.trim(),
      plannedMinutes,
      goalName: taskForm.trackGoal
        ? taskForm.goal.trim() || undefined
        : undefined,
      goalProgress: taskForm.trackGoal
        ? Math.min(100, Math.max(0, Number(taskForm.progress) || 0))
        : undefined,
    })
    if (
      taskAssignee !==
      (tasks.find(t => t.id === editingTaskId)?.assignedTo ?? '')
    ) {
      reassignTask(editingTaskId, taskAssignee || null)
    }
    closeTaskModal()
    setNotice('Task updated.')
  }
  const handleFinishTask = (task: WorkspaceTask) => {
    finishTask(task, true)
    setNotice(`${task.name} finished.`)
  }
  const handleDeleteTask = (id: string) => {
    deleteTask(id)
    setNotice('Task removed.')
  }
  const handleDeleteParent = (task: WorkspaceTask) => {
    const childCount = tasks.filter(t => t.parentTaskId === task.id).length
    setPendingAction({ type: 'delete-parent', task, childCount })
  }
  const handleMoveTo = (taskId: string, parentId: string | null) => {
    moveTask(taskId, parentId)
    setNotice(
      parentId ? 'Task moved under its new parent.' : 'Task made standalone.',
    )
  }
  const confirmDeleteParentAndChildren = () => {
    if (pendingAction?.type !== 'delete-parent') return
    tasks
      .filter(task => task.parentTaskId === pendingAction.task.id)
      .forEach(child => deleteTask(child.id))
    deleteTask(pendingAction.task.id)
    setNotice(`${pendingAction.task.name} and its subtasks were removed.`)
    setPendingAction(null)
  }
  const confirmOrphanChildren = () => {
    if (pendingAction?.type !== 'delete-parent') return
    tasks
      .filter(task => task.parentTaskId === pendingAction.task.id)
      .forEach(child => moveTask(child.id, null))
    deleteTask(pendingAction.task.id)
    setNotice(
      `${pendingAction.task.name} removed — its subtasks are now standalone.`,
    )
    setPendingAction(null)
  }

  return (
    <>
      <Link
        href="/workspaces"
        className="mb-6 inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-forest"
      >
        <ArrowLeft size={14} /> Shared Workspaces
      </Link>
      {notice && (
        <div className="mb-6 rounded-xl border border-sage/40 bg-sage/10 px-4 py-3 text-xs text-forest">
          {notice}
        </div>
      )}
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-coral">
            {isOwner ? 'You own this workspace' : 'Shared workspace'}
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            {workspace.name}
          </h1>
          {workspace.description && (
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
              {workspace.description}
            </p>
          )}
          <p className="mt-3 text-[11px] text-muted">
            Timezone:{' '}
            <span className="font-semibold text-ink">{workspace.timezone}</span>
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {isOwner ? (
            <>
              <Button variant="secondary" onClick={() => setInviting(true)}>
                <UserPlus size={15} /> Invite
              </Button>
              <Button variant="secondary" onClick={() => setEditing(true)}>
                <Settings2 size={15} /> Edit workspace
              </Button>
            </>
          ) : (
            <Button
              variant="secondary"
              onClick={() => setPendingAction({ type: 'leave' })}
            >
              <LogOut size={15} /> Leave workspace
            </Button>
          )}
        </div>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-line bg-panel px-4 py-3">
          <p className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-muted">
            <Users size={12} /> Members
          </p>
          <p className="mt-1.5 text-lg font-bold text-ink">{stats.members}</p>
        </div>
        <div className="rounded-xl border border-line bg-panel px-4 py-3">
          <p className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-muted">
            <Clock3 size={12} /> Working
          </p>
          <p className="mt-1.5 text-lg font-bold text-forest">
            {stats.working}
          </p>
        </div>
        <div className="rounded-xl border border-line bg-panel px-4 py-3">
          <p className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-muted">
            <ListTodo size={12} /> Queued
          </p>
          <p className="mt-1.5 text-lg font-bold text-ink">{stats.queued}</p>
        </div>
        <div className="rounded-xl border border-line bg-panel px-4 py-3">
          <p className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-muted">
            <CircleCheck size={12} /> Completed today
          </p>
          <p className="mt-1.5 text-lg font-bold text-ink">
            {stats.completedToday}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-panel shadow-sm">
        <div className="border-b border-line/70 px-5 py-4">
          <h2 className="text-sm font-bold tracking-tight text-ink">
            Members{' '}
            <span className="font-mono text-xs font-normal text-muted">
              {members.length}
            </span>
          </h2>
        </div>
        <div className="divide-y divide-line/70">
          {members.map(member => {
            const initials = (member.fullName || member.email || '?')
              .charAt(0)
              .toUpperCase()
            return (
              <div
                key={member.id}
                className="flex items-center gap-3 px-5 py-3.5"
              >
                <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full border border-line bg-forest text-xs font-bold text-white">
                  {member.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={member.avatarUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    initials
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-ink">
                    {member.fullName || member.email || 'Member'}
                    {member.userId === user.id && (
                      <span className="ml-1.5 font-normal text-muted">
                        (you)
                      </span>
                    )}
                  </p>
                  {member.email && (
                    <p className="truncate text-[10px] text-muted">
                      {member.email}
                    </p>
                  )}
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 font-mono text-[9px] uppercase ${member.role === 'owner' ? 'bg-sage/20 text-forest' : 'bg-slate-100 text-muted'}`}
                >
                  {member.role}
                </span>
                {isOwner && member.role !== 'owner' && (
                  <button
                    aria-label={`Remove ${member.fullName || member.email}`}
                    onClick={() => setPendingAction({ type: 'remove', member })}
                    className="rounded-lg p-2 text-muted transition hover:bg-coral/10 hover:text-coral"
                  >
                    <UserMinus size={15} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {isOwner && invitations.length > 0 && (
        <div className="mt-6 rounded-2xl border border-line bg-panel shadow-sm">
          <div className="border-b border-line/70 px-5 py-4">
            <h2 className="flex items-center gap-2 text-sm font-bold tracking-tight text-ink">
              <Mail size={15} /> Invitations
            </h2>
          </div>
          <div className="divide-y divide-line/70">
            {invitations.map(invitation => (
              <div
                key={invitation.id}
                className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-ink">
                    {invitation.invitedEmail}
                  </p>
                  {invitation.rejectionReason && (
                    <p className="mt-1 text-[11px] italic leading-5 text-coral">
                      &ldquo;{invitation.rejectionReason}&rdquo;
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 font-mono text-[9px] uppercase ${INVITATION_STATUS_STYLE[invitation.status]}`}
                  >
                    {invitation.status}
                  </span>
                  {invitation.status === 'pending' && (
                    <button
                      aria-label={`Cancel invitation to ${invitation.invitedEmail}`}
                      onClick={() => cancelInvitation(invitation.id)}
                      className="rounded-lg p-1.5 text-muted transition hover:bg-coral/10 hover:text-coral"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {workingNow.length > 0 && (
        <div className="mt-8 rounded-2xl border border-sage/40 bg-sage/5 p-5 sm:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.1em] text-forest">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-forest opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-forest" />
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

      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold tracking-tight text-ink">
            Queue{' '}
            <span className="font-mono text-xs font-normal text-muted">
              {queueTasks.filter(task => !task.parentTaskId).length}
            </span>
          </h2>
          <Button onClick={openAddTask}>
            <CirclePlus size={15} /> Add task
          </Button>
        </div>
        {!tasksReady ? null : queueTasks.length === 0 ? (
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
            onStart={startTask}
            onPause={pauseTask}
            onFinish={handleFinishTask}
            onEdit={openEditTask}
            onDelete={handleDeleteTask}
            onReassign={reassignTask}
            onReorder={reorderTasks}
            onAddSubtask={openAddSubtask}
            onDeleteParent={handleDeleteParent}
            onMoveTo={handleMoveTo}
          />
        )}
      </div>

      {completedTasks.length > 0 && (
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
            onStart={startTask}
            onPause={pauseTask}
            onFinish={handleFinishTask}
            onEdit={openEditTask}
            onDelete={handleDeleteTask}
            onReassign={reassignTask}
            onReorder={() => {}}
            onAddSubtask={openAddSubtask}
            onDeleteParent={handleDeleteParent}
            onMoveTo={handleMoveTo}
          />
        </div>
      )}

      <div className="mt-8 rounded-2xl border border-line bg-panel shadow-sm">
        <div className="border-b border-line/70 px-5 py-4">
          <h2 className="flex items-center gap-2 text-sm font-bold tracking-tight text-ink">
            <Activity size={15} /> Activity
          </h2>
        </div>
        <WorkspaceActivityFeed events={activityEvents} members={members} />
      </div>

      {taskModal === 'add' && (
        <Modal
          eyebrow={pendingParentId ? 'New subtask' : 'New task'}
          title={pendingParentId ? 'Add a subtask' : 'Add a task'}
          onClose={closeTaskModal}
        >
          <WorkspaceTaskForm
            values={taskForm}
            setValues={setTaskForm}
            members={members}
            assignedTo={taskAssignee}
            setAssignedTo={setTaskAssignee}
            submitLabel={pendingParentId ? 'Add subtask' : 'Add task'}
            onSubmit={handleAddTask}
            onCancel={closeTaskModal}
          />
        </Modal>
      )}
      {taskModal === 'edit' && (
        <Modal
          eyebrow="Edit task"
          title="Refine this task"
          onClose={closeTaskModal}
        >
          <WorkspaceTaskForm
            values={taskForm}
            setValues={setTaskForm}
            members={members}
            assignedTo={taskAssignee}
            setAssignedTo={setTaskAssignee}
            submitLabel="Save changes"
            onSubmit={handleEditTask}
            onCancel={closeTaskModal}
          />
        </Modal>
      )}
      {completionTask && (
        <CompletionModal
          taskName={completionTask.name}
          onStop={() => setCompletionTask(null)}
        />
      )}
      {pendingAction?.type === 'delete-parent' && (
        <DeleteParentModal
          taskName={pendingAction.task.name}
          childCount={pendingAction.childCount}
          onDeleteAll={confirmDeleteParentAndChildren}
          onOrphan={confirmOrphanChildren}
          onClose={() => setPendingAction(null)}
        />
      )}

      {editing && (
        <EditWorkspaceModal
          workspace={workspace}
          onSave={updateWorkspace}
          onClose={() => setEditing(false)}
        />
      )}
      {inviting && (
        <InviteMemberModal
          onInvite={inviteByEmail}
          onClose={() => setInviting(false)}
        />
      )}
      {pendingAction?.type === 'remove' && (
        <ConfirmModal
          title="Remove this member?"
          message={`${pendingAction.member.fullName || pendingAction.member.email || 'This member'} will lose access to this workspace immediately.`}
          confirmLabel="Remove member"
          onConfirm={confirmRemove}
          onClose={() => setPendingAction(null)}
        />
      )}
      {pendingAction?.type === 'leave' && (
        <ConfirmModal
          title="Leave this workspace?"
          message="You'll lose access to its tasks and activity. An owner can invite you back later."
          confirmLabel="Leave workspace"
          onConfirm={confirmLeave}
          onClose={() => setPendingAction(null)}
        />
      )}
    </>
  )
}
