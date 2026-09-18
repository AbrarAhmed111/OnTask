'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import { showErrorToast, showSuccessToast } from '@/lib/toast'
import { WorkspaceTasksSection } from '@/components/workspaces/WorkspaceTasksSection'
import { WorkspaceGoalsSection } from '@/components/workspaces/WorkspaceGoalsSection'
import { WorkspaceResourcesSection } from '@/components/workspaces/WorkspaceResourcesSection'
import { WorkspaceActivitySection } from '@/components/workspaces/WorkspaceActivitySection'
import { WorkspaceSummarySection } from '@/components/workspaces/WorkspaceSummarySection'
import { WorkspaceTaskForm } from '@/components/workspaces/WorkspaceTaskForm'
import { CompletionModal } from '@/components/tasks/CompletionModal'
import { GoalForm } from '@/components/goals/GoalForm'
import { ResourcesModal } from '@/components/resources/ResourcesModal'
import { Modal } from '@/components/ui/Modal'
import { useWorkspaceDetail } from '@/components/workspaces/WorkspaceDetailContext'
import { useCompletionAlert } from '@/hooks/useCompletionAlert'
import { useSettings } from '@/hooks/useSettings'
import { useWorkspaceTasks } from '@/hooks/useWorkspaceTasks'
import { useWorkspaceGoals, GoalFormValues } from '@/hooks/useWorkspaceGoals'
import { useWorkspaceResources } from '@/hooks/useWorkspaceResources'
import { useWorkspaceActivity } from '@/hooks/useWorkspaceActivity'
import { useWorkspaceSummary } from '@/hooks/useWorkspaceSummary'
import { formatTimeOfDay } from '@/lib/dailyReportWindow'
import { describeUploadOutcome } from '@/lib/resourceUploads'
import { WorkspaceTask } from '@/types/workspace'
import { TaskFormValues } from '@/types'

type GoalWorkingTask = {
  task: WorkspaceTask
  goalName: string
}

const emptyTaskForm: TaskFormValues = {
  name: '',
  hours: '1',
  minutes: '0',
  goal: '',
  progress: '0',
  trackGoal: false,
}

const emptyGoalForm: GoalFormValues = {
  name: '',
  description: '',
  targetDate: '',
}

export function WorkspaceOverviewClient() {
  const { workspaceId, user, workspace, members, isOwner, isPersonal, ready } =
    useWorkspaceDetail()
  // The completion-sound preference is per person and device (localStorage),
  // not per workspace, so the same setting governs a guest's tasks, a
  // personal workspace and every shared one. Read once here and handed down.
  const { settings } = useSettings()
  const completionAlert = useCompletionAlert<WorkspaceTask>(
    settings.soundEnabled,
  )
  const {
    tasks,
    ready: tasksReady,
    error: tasksError,
    startTask,
    pauseTask,
    emergencyStopTask,
    finishTask,
    addTask,
    updateTask,
    deleteTask,
    reassignTask,
    reorderTasks,
    getLiveSeconds,
  } = useWorkspaceTasks(
    workspaceId,
    user,
    members,
    completionAlert.notify,
    isPersonal,
  )
  const {
    goals,
    ready: goalsReady,
    error: goalsError,
    createGoal,
    updateGoal,
    setGoalStatus,
  } = useWorkspaceGoals(workspaceId, user)
  const {
    resources,
    ready: resourcesReady,
    error: resourcesError,
    uploads: resourceUploads,
    uploadMany: uploadResources,
    dismissUploads: dismissResourceUploads,
    remove: removeResource,
    getSignedUrl,
  } = useWorkspaceResources(workspaceId, user)
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
  const [goalModalOpen, setGoalModalOpen] = useState(false)
  const [resourcesModalOpen, setResourcesModalOpen] = useState(false)
  const [goalForm, setGoalForm] = useState<GoalFormValues>(emptyGoalForm)
  const [goalWorkingTasks, setGoalWorkingTasks] = useState<
    Record<string, GoalWorkingTask[]>
  >({})

  useEffect(() => {
    if (tasksError) showErrorToast(tasksError)
  }, [tasksError])
  useEffect(() => {
    if (goalsError) showErrorToast(goalsError)
  }, [goalsError])
  useEffect(() => {
    if (resourcesError) showErrorToast(resourcesError)
  }, [resourcesError])

  const workingNow = tasks.filter(task => task.status === 'working')
  const isDone = (task: WorkspaceTask) =>
    task.status === 'completed' || task.status === 'skipped'
  // Ordinary tasks are permanently flat now (hierarchy only exists inside
  // Goals — see supabase/migrations/0021_workspace_goals.sql), so the queue
  // and completed lists are a plain status split with no parent grouping.
  const queueTasks = tasks.filter(task => !isDone(task))
  const completedTasks = tasks.filter(isDone)
  const workingGoalTasks = Object.values(goalWorkingTasks).flat()
  const handleWorkingTasksChange = useCallback(
    (goalId: string, workingTasks: WorkspaceTask[]) => {
      setGoalWorkingTasks(current => ({
        ...current,
        [goalId]: workingTasks.map(task => ({
          task,
          goalName: goals.find(goal => goal.id === goalId)?.name ?? 'Goal',
        })),
      }))
    },
    [goals],
  )

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const stats = {
    members: members.length,
    working: workingNow.length + workingGoalTasks.length,
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
  }
  const openAddTask = () => {
    setTaskForm({ ...emptyTaskForm })
    setTaskAssignee('')
    setTaskModal('add')
  }
  const openEditTask = (task: WorkspaceTask) => {
    setEditingTaskId(task.id)
    setTaskForm({
      name: task.name,
      hours: String(Math.floor(task.plannedMinutes / 60)),
      minutes: String(task.plannedMinutes % 60),
      goal: task.progressLabel || '',
      progress: String(task.progressPercentage || 0),
      trackGoal: Boolean(task.progressLabel),
    })
    setTaskAssignee(task.assignedTo ?? '')
    setTaskModal('edit')
  }

  const handleAddTask = (event: FormEvent) => {
    if (addTask(event, taskForm, null, taskAssignee || null)) {
      closeTaskModal()
      showSuccessToast('Task added.')
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
      progressLabel: taskForm.trackGoal
        ? taskForm.goal.trim() || undefined
        : undefined,
      progressPercentage: taskForm.trackGoal
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

  const openAddGoal = () => {
    setGoalForm({ ...emptyGoalForm })
    setGoalModalOpen(true)
  }
  const handleAddGoal = (event: FormEvent) => {
    if (createGoal(event, goalForm)) {
      setGoalModalOpen(false)
      showSuccessToast('Goal created.')
    }
  }

  const handleUploadResources = async (files: File[]) => {
    const outcome = describeUploadOutcome(await uploadResources(files))
    if (!outcome) return
    if (outcome.tone === 'success') showSuccessToast(outcome.message)
    else showErrorToast(outcome.message)
  }
  const handleDeleteResource = async (id: string) => {
    // Report what the server actually did, not what we hoped for.
    const result = await removeResource(id)
    if (result.ok) showSuccessToast('Resource removed.')
    else showErrorToast(result.message)
  }

  return (
    <div className="space-y-8">
      <WorkspaceTasksSection
        ready={ready && tasksReady}
        error={tasksError}
        isPersonal={isPersonal}
        stats={stats}
        workingNow={workingNow}
        workingGoalTasks={workingGoalTasks}
        tasks={tasks}
        members={members}
        user={user}
        queueTasks={queueTasks}
        completedTasks={completedTasks}
        getLiveSeconds={getLiveSeconds}
        onAddTask={openAddTask}
        onStart={startTask}
        onPause={pauseTask}
        onEmergencyStop={emergencyStopTask}
        onFinish={handleFinishTask}
        onEdit={openEditTask}
        onDelete={handleDeleteTask}
        onReassign={reassignTask}
        onReorder={reorderTasks}
      />

      <WorkspaceGoalsSection
        ready={ready && goalsReady}
        error={goalsError}
        goals={goals}
        workspaceId={workspaceId}
        isPersonal={isPersonal}
        soundEnabled={settings.soundEnabled}
        user={user}
        members={members}
        updateGoal={updateGoal}
        setGoalStatus={setGoalStatus}
        onWorkingTasksChange={handleWorkingTasksChange}
        onAddGoal={openAddGoal}
      />

      <WorkspaceResourcesSection
        ready={ready && resourcesReady}
        error={resourcesError}
        isPersonal={isPersonal}
        resources={resources}
        onOpen={() => setResourcesModalOpen(true)}
        onAddResource={() => setResourcesModalOpen(true)}
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
        <Modal eyebrow="New task" title="Add a task" onClose={closeTaskModal}>
          <WorkspaceTaskForm
            values={taskForm}
            setValues={setTaskForm}
            isPersonal={isPersonal}
            members={members}
            assignedTo={taskAssignee}
            setAssignedTo={setTaskAssignee}
            submitLabel="Add task"
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
            isPersonal={isPersonal}
            members={members}
            assignedTo={taskAssignee}
            setAssignedTo={setTaskAssignee}
            submitLabel="Save changes"
            onSubmit={handleEditTask}
            onCancel={closeTaskModal}
          />
        </Modal>
      )}
      {goalModalOpen && (
        <Modal
          eyebrow="New goal"
          title="Create a goal"
          onClose={() => setGoalModalOpen(false)}
        >
          <GoalForm
            values={goalForm}
            setValues={setGoalForm}
            submitLabel="Create goal"
            onSubmit={handleAddGoal}
            onCancel={() => setGoalModalOpen(false)}
          />
        </Modal>
      )}
      {completionAlert.task && (
        <CompletionModal
          taskName={completionAlert.task.name}
          onStop={completionAlert.dismiss}
        />
      )}
      {resourcesModalOpen && (
        <ResourcesModal
          resources={resources}
          members={members}
          userId={user?.id}
          isOwner={isOwner}
          loading={!(ready && resourcesReady)}
          uploads={resourceUploads}
          onUpload={handleUploadResources}
          onDismissUploads={dismissResourceUploads}
          onDelete={handleDeleteResource}
          getSignedUrl={getSignedUrl}
          onClose={() => setResourcesModalOpen(false)}
        />
      )}
    </div>
  )
}
