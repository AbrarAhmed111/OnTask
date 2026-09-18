'use client'

import { FormEvent, useEffect, useState } from 'react'
import { showErrorToast, showSuccessToast } from '@/lib/toast'
import { WorkspaceTasksSection } from '@/components/workspaces/WorkspaceTasksSection'
import { WorkspaceActivitySection } from '@/components/workspaces/WorkspaceActivitySection'
import { WorkspaceSummarySection } from '@/components/workspaces/WorkspaceSummarySection'
import { WorkspaceTaskForm } from '@/components/workspaces/WorkspaceTaskForm'
import { DeleteParentModal } from '@/components/tasks/DeleteParentModal'
import { CompletionModal } from '@/components/tasks/CompletionModal'
import { Modal } from '@/components/ui/Modal'
import { useWorkspaceDetail } from '@/components/workspaces/WorkspaceDetailContext'
import { useWorkspaceTasks } from '@/hooks/useWorkspaceTasks'
import { useWorkspaceActivity } from '@/hooks/useWorkspaceActivity'
import { useWorkspaceSummary } from '@/hooks/useWorkspaceSummary'
import { formatTimeOfDay } from '@/lib/dailyReportWindow'
import { WorkspaceTask } from '@/types/workspace'
import { TaskFormValues } from '@/types'

const emptyTaskForm: TaskFormValues = {
  name: '',
  hours: '1',
  minutes: '0',
  goal: '',
  progress: '0',
  trackGoal: false,
}

export function WorkspaceOverviewClient() {
  const { workspaceId, user, workspace, members, ready } = useWorkspaceDetail()
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
    error: summaryError,
    generating: summaryGenerating,
    regenerate: regenerateSummary,
    nextReportLabel,
  } = useWorkspaceSummary(
    workspaceId,
    user,
    workspace?.timezone ?? '',
    workspace?.reportTime ?? '12:00:00',
  )

  const [taskModal, setTaskModal] = useState<'add' | 'edit' | null>(null)
  const [taskForm, setTaskForm] = useState<TaskFormValues>(emptyTaskForm)
  const [taskAssignee, setTaskAssignee] = useState('')
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [pendingParentId, setPendingParentId] = useState<string | null>(null)
  const [pendingDeleteParent, setPendingDeleteParent] = useState<{
    task: WorkspaceTask
    childCount: number
  } | null>(null)

  useEffect(() => {
    if (tasksError) showErrorToast(tasksError)
  }, [tasksError])

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

  const handleRegenerateSummary = async () => {
    const result = await regenerateSummary()
    if (result.success) {
      showSuccessToast('Daily Report regenerated.')
    } else {
      showErrorToast(result.error || 'Failed to regenerate the report.')
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
    setPendingDeleteParent({ task, childCount })
  }
  const handleMoveTo = (taskId: string, parentId: string | null) => {
    moveTask(taskId, parentId)
    showSuccessToast(
      parentId ? 'Task moved under its new parent.' : 'Task made standalone.',
    )
  }
  const confirmDeleteParentAndChildren = () => {
    if (!pendingDeleteParent) return
    tasks
      .filter(task => task.parentTaskId === pendingDeleteParent.task.id)
      .forEach(child => deleteTask(child.id))
    deleteTask(pendingDeleteParent.task.id)
    showSuccessToast(
      `${pendingDeleteParent.task.name} and its subtasks were removed.`,
    )
    setPendingDeleteParent(null)
  }
  const confirmOrphanChildren = () => {
    if (!pendingDeleteParent) return
    tasks
      .filter(task => task.parentTaskId === pendingDeleteParent.task.id)
      .forEach(child => moveTask(child.id, null))
    deleteTask(pendingDeleteParent.task.id)
    showSuccessToast(
      `${pendingDeleteParent.task.name} removed — its subtasks are now standalone.`,
    )
    setPendingDeleteParent(null)
  }

  return (
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
        error={summaryError}
        summary={summary}
        members={members}
        nextReportLabel={nextReportLabel}
        reportTimeLabel={formatTimeOfDay(workspace?.reportTime ?? '12:00:00')}
        generating={summaryGenerating}
        onRegenerate={handleRegenerateSummary}
      />

      <WorkspaceActivitySection
        ready={ready && activityReady}
        error={activityError}
        events={activityEvents}
        members={members}
      />

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
      {pendingDeleteParent && (
        <DeleteParentModal
          taskName={pendingDeleteParent.task.name}
          childCount={pendingDeleteParent.childCount}
          onDeleteAll={confirmDeleteParentAndChildren}
          onOrphan={confirmOrphanChildren}
          onClose={() => setPendingDeleteParent(null)}
        />
      )}
    </div>
  )
}
