'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { showErrorToast, showSuccessToast } from '@/lib/toast'
import { EditWorkspaceModal } from '@/components/workspaces/EditWorkspaceModal'
import { InviteMemberModal } from '@/components/workspaces/InviteMemberModal'
import {
  WorkspaceShell,
  WorkspaceSection,
} from '@/components/workspaces/WorkspaceShell'
import { WorkspaceTasksSection } from '@/components/workspaces/WorkspaceTasksSection'
import { WorkspaceMembersSection } from '@/components/workspaces/WorkspaceMembersSection'
import { WorkspaceActivitySection } from '@/components/workspaces/WorkspaceActivitySection'
import { WorkspaceSummarySection } from '@/components/workspaces/WorkspaceSummarySection'
import { WorkspaceSettingsSection } from '@/components/workspaces/WorkspaceSettingsSection'
import { WorkspaceTaskForm } from '@/components/workspaces/WorkspaceTaskForm'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { DeleteParentModal } from '@/components/tasks/DeleteParentModal'
import { CompletionModal } from '@/components/tasks/CompletionModal'
import { Modal } from '@/components/ui/Modal'
import { useWorkspace } from '@/hooks/useWorkspace'
import { useWorkspaceInvitations } from '@/hooks/useWorkspaceInvitations'
import { useWorkspaceTasks } from '@/hooks/useWorkspaceTasks'
import { useWorkspaceActivity } from '@/hooks/useWorkspaceActivity'
import { useWorkspaceSummary } from '@/hooks/useWorkspaceSummary'
import { useWorkspacePresence } from '@/hooks/useWorkspacePresence'
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

export function WorkspaceDetailClient({
  workspaceId,
}: {
  workspaceId: string
}) {
  const { user, ready: authReady, handleLogout } = useAuthGuard()

  if (!authReady || !user) {
    return <main className="min-h-screen bg-paper" />
  }

  return (
    <WorkspaceDetail
      workspaceId={workspaceId}
      user={user}
      onLogout={handleLogout}
    />
  )
}

type PendingAction =
  | { type: 'remove'; member: WorkspaceMember }
  | { type: 'leave' }
  | { type: 'delete-parent'; task: WorkspaceTask; childCount: number }

function WorkspaceDetail({
  workspaceId,
  user,
  onLogout,
}: {
  workspaceId: string
  user: AuthUser
  onLogout: () => void
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
  const {
    invitations,
    ready: invitationsReady,
    inviteByEmail,
    cancelInvitation,
    deleteInvitation,
  } = useWorkspaceInvitations(workspaceId, user)
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
  const {
    events: activityEvents,
    ready: activityReady,
    error: activityError,
  } = useWorkspaceActivity(workspaceId, user)
  const {
    summary,
    ready: summaryReady,
    generating: summaryGenerating,
    generate: generateSummary,
    summaryDate,
  } = useWorkspaceSummary(workspaceId, user, workspace?.timezone ?? '')
  const onlineUserIds = useWorkspacePresence(workspaceId, user)
  const [section, setSection] = useState<WorkspaceSection>('overview')
  const [editing, setEditing] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [taskModal, setTaskModal] = useState<'add' | 'edit' | null>(null)
  const [taskForm, setTaskForm] = useState<TaskFormValues>(emptyTaskForm)
  const [taskAssignee, setTaskAssignee] = useState('')
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [pendingParentId, setPendingParentId] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [memberActionError, setMemberActionError] = useState<string | null>(
    null,
  )
  const [settingsError, setSettingsError] = useState<string | null>(null)

  useEffect(() => {
    if (tasksError) showErrorToast(tasksError)
  }, [tasksError])

  if (ready && (error || !workspace)) {
    return (
      <main className="min-h-screen bg-paper">
        <div className="mx-auto flex min-h-screen w-[min(560px,calc(100%-32px))] flex-col items-center justify-center text-center">
          <div className="rounded-2xl border border-coral/20 bg-coral/5 p-6">
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
        </div>
      </main>
    )
  }

  const isOwner = role === 'owner'
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
    if (result.success) {
      setMemberActionError(null)
      showSuccessToast(
        `${pendingAction.member.fullName || pendingAction.member.email || 'Member'} removed from the workspace.`,
      )
    } else {
      const message = result.error || 'Failed to remove member.'
      setMemberActionError(message)
      showErrorToast(message)
    }
  }

  const confirmLeave = async () => {
    const result = await removeMember(user.id)
    setPendingAction(null)
    if (result.success) {
      router.push('/workspaces')
      return
    }
    const message = result.error || 'Failed to leave workspace.'
    setMemberActionError(message)
    showErrorToast(message)
  }

  const handleGenerateSummary = async () => {
    const result = await generateSummary('generate')
    if (!result.success)
      showErrorToast(result.error || 'Failed to generate summary.')
  }
  const handleRegenerateSummary = async () => {
    const result = await generateSummary('regenerate')
    if (result.success) {
      showSuccessToast('Summary regenerated.')
    } else {
      showErrorToast(result.error || 'Failed to regenerate summary.')
    }
  }

  const openMemberAction = (action: PendingAction) => {
    setMemberActionError(null)
    setPendingAction(action)
  }

  const handleUpdateWorkspace: typeof updateWorkspace = async patch => {
    const result = await updateWorkspace(patch)
    if (result.success) {
      setSettingsError(null)
    } else {
      setSettingsError(result.error || 'Failed to save changes.')
    }
    return result
  }

  const handleCancelInvitation = async (id: string) => {
    const result = await cancelInvitation(id)
    if (result.success) {
      showSuccessToast('Invitation cancelled.')
    } else {
      showErrorToast(result.error || 'Failed to cancel invitation.')
    }
  }

  const handleDeleteInvitation = async (id: string) => {
    const result = await deleteInvitation(id)
    if (result.success) {
      showSuccessToast('Invitation record deleted.')
    } else {
      showErrorToast(result.error || 'Failed to delete invitation record.')
    }
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
      showSuccessToast(pendingParentId ? 'Subtask added.' : 'Task added.')
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
    showSuccessToast('Task updated.')
  }
  const handleFinishTask = (task: WorkspaceTask) => {
    finishTask(task, true)
    showSuccessToast(`${task.name} finished.`)
  }
  const handleDeleteTask = (id: string) => {
    deleteTask(id)
    showSuccessToast('Task removed.')
  }
  const handleDeleteParent = (task: WorkspaceTask) => {
    const childCount = tasks.filter(t => t.parentTaskId === task.id).length
    setPendingAction({ type: 'delete-parent', task, childCount })
  }
  const handleMoveTo = (taskId: string, parentId: string | null) => {
    moveTask(taskId, parentId)
    showSuccessToast(
      parentId ? 'Task moved under its new parent.' : 'Task made standalone.',
    )
  }
  const confirmDeleteParentAndChildren = () => {
    if (pendingAction?.type !== 'delete-parent') return
    tasks
      .filter(task => task.parentTaskId === pendingAction.task.id)
      .forEach(child => deleteTask(child.id))
    deleteTask(pendingAction.task.id)
    showSuccessToast(
      `${pendingAction.task.name} and its subtasks were removed.`,
    )
    setPendingAction(null)
  }
  const confirmOrphanChildren = () => {
    if (pendingAction?.type !== 'delete-parent') return
    tasks
      .filter(task => task.parentTaskId === pendingAction.task.id)
      .forEach(child => moveTask(child.id, null))
    deleteTask(pendingAction.task.id)
    showSuccessToast(
      `${pendingAction.task.name} removed — its subtasks are now standalone.`,
    )
    setPendingAction(null)
  }

  return (
    <WorkspaceShell
      workspace={workspace}
      members={members}
      role={role}
      ready={ready}
      user={user}
      onlineUserIds={onlineUserIds}
      section={section}
      onSectionChange={setSection}
      onInvite={isOwner ? () => setInviting(true) : undefined}
      onLogout={onLogout}
    >
      {section === 'overview' && (
        <div className="space-y-8">
          <WorkspaceTasksSection
            ready={ready && tasksReady}
            error={tasksError}
            stats={stats}
            workingNow={workingNow}
            tasks={tasks}
            members={members}
            queueTasks={queueTasks}
            completedTasks={completedTasks}
            getLiveSeconds={getLiveSeconds}
            onAddTask={openAddTask}
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

          <WorkspaceSummarySection
            ready={ready && summaryReady}
            summary={summary}
            members={members}
            summaryDate={summaryDate}
            generating={summaryGenerating}
            onGenerate={handleGenerateSummary}
            onRegenerate={handleRegenerateSummary}
          />

          <WorkspaceActivitySection
            ready={ready && activityReady}
            error={activityError}
            events={activityEvents}
            members={members}
          />
        </div>
      )}

      {section === 'members' && (
        <WorkspaceMembersSection
          ready={ready}
          error={memberActionError}
          members={members}
          currentUserId={user.id}
          onlineUserIds={onlineUserIds}
          isOwner={isOwner}
          onRemoveMember={member =>
            openMemberAction({ type: 'remove', member })
          }
          invitationsReady={invitationsReady}
          invitations={invitations}
          onInvite={() => setInviting(true)}
          onCancelInvitation={handleCancelInvitation}
          onDeleteInvitation={handleDeleteInvitation}
          onLeave={() => openMemberAction({ type: 'leave' })}
        />
      )}

      {section === 'settings' && isOwner && (
        <WorkspaceSettingsSection
          ready={ready}
          error={settingsError}
          workspace={workspace}
          onEdit={() => {
            setSettingsError(null)
            setEditing(true)
          }}
        />
      )}

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

      {editing && workspace && (
        <EditWorkspaceModal
          workspace={workspace}
          onSave={handleUpdateWorkspace}
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
    </WorkspaceShell>
  )
}
