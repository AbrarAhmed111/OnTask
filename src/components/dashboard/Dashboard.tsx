'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, CirclePlus, Pause, Play, Plus, Target } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { DailyProgress } from '@/components/dashboard/DailyProgress'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { TaskList } from '@/components/dashboard/TaskList'
import { usePersonalTasks } from '@/hooks/usePersonalTasks'
import { Task, TaskFormValues } from '@/types'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { TaskForm } from '@/components/tasks/TaskForm'
import { GoalModal } from '@/components/tasks/GoalModal'
import { CompletionModal } from '@/components/tasks/CompletionModal'
import { SettingsModal } from '@/components/settings/SettingsModal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { DeleteParentModal } from '@/components/tasks/DeleteParentModal'
import { AuthModal, AuthStep } from '@/components/auth/AuthModal'
import { GoogleOneTap } from '@/components/auth/GoogleOneTap'
import { MigrationModal } from '@/components/auth/MigrationModal'
import { useSettings } from '@/hooks/useSettings'
import { useAuth } from '@/hooks/useAuth'
import { useMyInvitations } from '@/hooks/useMyInvitations'
import {
  clearStoredData,
  isMigrationResolved,
  loadTasks,
  markMigrationResolved,
  saveTasks,
} from '@/lib/storage'
import { requestNotificationPermission } from '@/lib/notifications'
import { clientSignout } from '@/lib/auth/signout'
import { migrateGuestTasks } from '@/lib/tasks/migration'

const emptyForm: TaskFormValues = {
  name: '',
  hours: '1',
  minutes: '0',
  goal: '',
  progress: '0',
  trackGoal: true,
}

type Confirmation =
  | { type: 'delete'; taskId: string }
  | { type: 'reset' }
  | { type: 'delete-parent'; task: Task; childCount: number }

export function Dashboard() {
  const router = useRouter()
  const { settings, ready: settingsReady, updateSettings } = useSettings()
  const {
    user,
    ready: authReady,
    passwordRecovery,
    clearPasswordRecovery,
  } = useAuth()
  const { invitations: myInvitations } = useMyInvitations(user)
  const [completionTask, setCompletionTask] = useState<Task | null>(null)
  const {
    tasks,
    ready,
    activeTask,
    totalSeconds,
    updateTask,
    startTask,
    pauseTask,
    finishTask,
    addTask,
    deleteTask,
    restartTask,
    moveTask,
    reorderTasks,
    getLiveSeconds: liveSeconds,
    error: dataError,
  } = usePersonalTasks(
    user,
    settings,
    task => settings.soundEnabled && setCompletionTask(task),
  )
  const [modal, setModal] = useState<
    'add' | 'edit' | 'goal' | 'auth' | 'migration' | null
  >(null)
  const [authStep, setAuthStep] = useState<AuthStep>('login')
  const [migrationTaskCount, setMigrationTaskCount] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pendingParentId, setPendingParentId] = useState<string | null>(null)
  const [form, setForm] = useState<TaskFormValues>(emptyForm)
  const [goalProgress, setGoalProgress] = useState('0')
  const [notice, setNotice] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [inviteContext, setInviteContext] = useState<{
    id: string
    workspaceName: string
    invitedEmail: string | null
  } | null>(null)

  useEffect(() => {
    if (!notice) return

    const timeout = window.setTimeout(() => setNotice(''), 5000)
    return () => window.clearTimeout(timeout)
  }, [notice])

  useEffect(() => {
    if (dataError) setNotice(dataError)
  }, [dataError])

  const openAuth = (step: AuthStep = 'login') => {
    setAuthStep(step)
    setModal('auth')
  }

  // A workspace invitation email link lands here as /?invite=&workspace=
  // (guests bounced off /workspaces by useAuthGuard keep these params too —
  // see useAuthGuard.ts). Already-signed-in visitors skip the modal
  // entirely and go straight to the invitation; guests get a contextual
  // login/signup prompt instead of the generic one.
  useEffect(() => {
    if (!authReady) return
    const params = new URLSearchParams(window.location.search)
    const invite = params.get('invite')
    if (!invite) return
    window.history.replaceState(null, '', window.location.pathname)
    if (user) {
      router.push(`/workspaces?invite=${encodeURIComponent(invite)}`)
      return
    }
    setInviteContext({
      id: invite,
      workspaceName: params.get('workspace') || 'the workspace',
      invitedEmail: params.get('email'),
    })
    openAuth('login')
  }, [authReady, user, router])

  useEffect(() => {
    if (!passwordRecovery) return
    openAuth('reset')
    clearPasswordRecovery()
  }, [passwordRecovery, clearPasswordRecovery])

  useEffect(() => {
    if (!user || !ready || isMigrationResolved()) return
    const localTasks = loadTasks()
    if (localTasks.length === 0) return
    setMigrationTaskCount(localTasks.length)
    setModal('migration')
  }, [user, ready])

  const handleAuthenticated = () => {
    closeModal()
    if (inviteContext) {
      router.push(`/workspaces?invite=${encodeURIComponent(inviteContext.id)}`)
      setInviteContext(null)
      return
    }
    setNotice('Signed in to OnTask.')
  }

  const handleMigrate = async () => {
    const result = await migrateGuestTasks(loadTasks())
    if (result.success) {
      saveTasks([])
      markMigrationResolved()
      window.location.reload()
    }
    return result
  }

  const handleKeepLocal = () => {
    markMigrationResolved()
    closeModal()
    setNotice('Your local tasks will stay on this device.')
  }

  const handleOpenWorkspaces = () => {
    if (!user) {
      openAuth('login')
      return
    }
    router.push('/workspaces')
  }

  const handleLogout = async () => {
    const result = await clientSignout()
    setNotice(result.success ? "You're signed out." : 'Sign out failed.')
  }

  const closeModal = () => {
    setModal(null)
    setEditingId(null)
    setPendingParentId(null)
    setInviteContext(null)
  }
  const openAdd = () => {
    setForm({ ...emptyForm })
    setPendingParentId(null)
    setModal('add')
  }
  const openAddSubtask = (parentId: string) => {
    setForm({ ...emptyForm })
    setPendingParentId(parentId)
    setModal('add')
  }
  const openEdit = (task: Task) => {
    setEditingId(task.id)
    setForm({
      name: task.name,
      hours: String(Math.floor(task.plannedMinutes / 60)),
      minutes: String(task.plannedMinutes % 60),
      goal: task.goalName || '',
      progress: String(task.goalProgress || 0),
      trackGoal: Boolean(task.goalName),
    })
    setModal('edit')
  }
  const openGoal = (task: Task) => {
    setEditingId(task.id)
    setGoalProgress(String(task.goalProgress || 0))
    setModal('goal')
  }

  const handleAdd = async (event: FormEvent) => {
    if (addTask(event, form, pendingParentId)) {
      const wasSubtask = Boolean(pendingParentId)
      closeModal()
      setNotice(wasSubtask ? 'Subtask added.' : 'Task added to your day.')
      const permission = await requestNotificationPermission()
      if (permission === 'denied') {
        setNotice(
          'Task added. Browser notifications are blocked; enable them in site settings.',
        )
      }
    }
  }
  const handleEdit = (event: FormEvent) => {
    event.preventDefault()
    if (!editingId) return
    const plannedMinutes =
      Number(form.hours || 0) * 60 + Number(form.minutes || 0)
    if (!form.name.trim() || plannedMinutes <= 0) return
    updateTask(editingId, {
      name: form.name.trim(),
      plannedMinutes,
      goalName: form.trackGoal ? form.goal.trim() || undefined : undefined,
      goalProgress: form.trackGoal
        ? Math.min(100, Math.max(0, Number(form.progress) || 0))
        : undefined,
    })
    closeModal()
    setNotice('Task updated.')
  }
  const handleGoal = (event: FormEvent) => {
    event.preventDefault()
    if (editingId)
      updateTask(editingId, {
        goalProgress: Math.min(100, Math.max(0, Number(goalProgress) || 0)),
      })
    closeModal()
    setNotice('Goal progress updated.')
  }
  const handleFinish = (task: Task) => {
    finishTask(task, true)
    setNotice(`${task.name} finished for today.`)
  }
  const handleDelete = (id: string) => {
    setConfirmation({ type: 'delete', taskId: id })
  }
  const handleDeleteParent = (task: Task) => {
    const childCount = tasks.filter(t => t.parentTaskId === task.id).length
    setConfirmation({ type: 'delete-parent', task, childCount })
  }
  const handleMoveTo = (taskId: string, parentId: string | null) => {
    moveTask(taskId, parentId)
    setNotice(
      parentId ? 'Task moved under its new parent.' : 'Task made standalone.',
    )
  }
  const handleReset = () => {
    setConfirmation({ type: 'reset' })
  }
  const closeConfirmation = () => setConfirmation(null)
  const confirmAction = () => {
    if (!confirmation) return

    if (confirmation.type === 'delete') {
      deleteTask(confirmation.taskId)
      setNotice('Task removed from today.')
      closeConfirmation()
      return
    }

    if (confirmation.type === 'delete-parent') return

    clearStoredData()
    window.location.reload()
  }
  const confirmDeleteParentAndChildren = () => {
    if (confirmation?.type !== 'delete-parent') return
    tasks
      .filter(task => task.parentTaskId === confirmation.task.id)
      .forEach(child => deleteTask(child.id))
    deleteTask(confirmation.task.id)
    setNotice(`${confirmation.task.name} and its subtasks were removed.`)
    closeConfirmation()
  }
  const confirmOrphanChildren = () => {
    if (confirmation?.type !== 'delete-parent') return
    tasks
      .filter(task => task.parentTaskId === confirmation.task.id)
      .forEach(child => moveTask(child.id, null))
    deleteTask(confirmation.task.id)
    setNotice(
      `${confirmation.task.name} removed — its subtasks are now standalone.`,
    )
    closeConfirmation()
  }

  if (!authReady || !ready || !settingsReady)
    return <main className="min-h-screen bg-paper" />

  const completedTasks = tasks.filter(
    task => task.status === 'completed' || task.status === 'skipped',
  ).length
  // Parents are containers, not runnable — never offer to auto-start one.
  const nextTask = tasks.find(
    task =>
      (task.status === 'pending' || task.status === 'paused') &&
      !tasks.some(t => t.parentTaskId === task.id),
  )
  return (
    <main className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_80%_0%,#e4f0e6_0,transparent_30%),linear-gradient(135deg,#f8faf7_0%,#eff3ee_100%)] text-ink">
      <Header
        onSettings={() => setSettingsOpen(true)}
        user={user}
        authReady={authReady}
        onOpenAuth={() => openAuth('login')}
        onOpenWorkspaces={handleOpenWorkspaces}
        onLogout={handleLogout}
        pendingInvitationCount={myInvitations.length}
      />
      <div className="mx-auto w-[min(1120px,calc(100%-32px))]">
        <section className="grid gap-9 py-12 sm:py-16 lg:grid-cols-[0.85fr_1.15fr] lg:items-end lg:gap-16">
          <div>
            <p className="mb-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-coral">
              <Target size={14} /> Today&apos;s focus
            </p>
            <h1 className="max-w-md text-4xl font-bold leading-[1.05] tracking-[-0.055em] text-ink sm:text-5xl">
              Make the hours <span className="text-forest">count.</span>
            </h1>
            <p className="mt-5 max-w-sm text-sm leading-7 text-muted">
              A clear plan for meaningful work. One task at a time, with the
              bigger picture always in sight.
            </p>
          </div>
          <DailyProgress
            totalSeconds={totalSeconds}
            completedTasks={completedTasks}
            taskCount={tasks.length}
            targetMinutes={settings.dailyTargetMinutes}
          />
        </section>
        <section className="pb-12">
          <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-coral">
                Your workday
              </p>
              <h2 className="text-2xl font-bold tracking-tight">
                Today&apos;s work{' '}
                <span className="font-mono text-sm font-normal text-muted">
                  {tasks.length}
                </span>
              </h2>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={openAdd}>
                <CirclePlus size={16} /> Add task
              </Button>
              <Button
                onClick={() =>
                  activeTask
                    ? pauseTask(activeTask)
                    : nextTask && startTask(nextTask.id)
                }
                disabled={tasks.length === 0}
              >
                {activeTask ? (
                  <>
                    <Pause size={15} /> Pause focus
                  </>
                ) : (
                  <>
                    <Play size={15} /> Start next
                  </>
                )}
              </Button>
            </div>
          </div>
          {notice && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-sage/40 bg-sage/10 px-4 py-3 text-xs text-forest animate-[fadeIn_180ms_ease-out]">
              <Check size={16} />
              <span>{notice}</span>
              <button
                className="ml-auto text-forest/60 hover:text-forest"
                onClick={() => setNotice('')}
              >
                Dismiss
              </button>
            </div>
          )}
          {tasks.length === 0 ? (
            <EmptyState onAdd={openAdd} />
          ) : (
            <TaskList
              tasks={tasks}
              getWorkedSeconds={liveSeconds}
              onStart={startTask}
              onPause={pauseTask}
              onFinish={handleFinish}
              onEdit={openEdit}
              onDelete={handleDelete}
              onRestart={task => {
                restartTask(task)
                setNotice(`${task.name} restarted as a new task.`)
              }}
              onUpdateGoal={openGoal}
              onReorder={reorderTasks}
              onAddSubtask={openAddSubtask}
              onDeleteParent={handleDeleteParent}
              onMoveTo={handleMoveTo}
            />
          )}
          {tasks.length > 0 && (
            <div className="flex justify-center pt-6">
              <button
                onClick={openAdd}
                className="inline-flex items-center gap-2 rounded-lg border border-dashed border-sage/70 px-4 py-2.5 text-xs font-semibold text-muted transition hover:border-forest hover:text-forest"
              >
                <Plus size={17} /> Add another task
              </button>
            </div>
          )}
        </section>
        <div className="mb-10 rounded-2xl border border-[#e5dbc8] bg-[#f4ecdf] p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/70 text-[#ae714d]">
              <Target size={16} />
            </div>
            <div>
              <p className="text-xs font-bold text-[#795f4b]">
                When you pause, your time pauses too.
              </p>
              <p className="mt-1 text-[11px] leading-5 text-[#947f6c]">
                Breaks are part of the plan. Return when you&apos;re ready.
              </p>
            </div>
          </div>
        </div>
      </div>
      <Footer />
      {modal === 'add' && (
        <Modal
          eyebrow={pendingParentId ? 'New subtask' : 'New focus'}
          title={pendingParentId ? 'Add a subtask' : 'Add a task to your day'}
          onClose={closeModal}
        >
          <TaskForm
            values={form}
            setValues={setForm}
            submitLabel={pendingParentId ? 'Add subtask' : 'Add task'}
            onSubmit={handleAdd}
            onCancel={closeModal}
          />
        </Modal>
      )}
      {modal === 'edit' && (
        <Modal
          eyebrow="Edit task"
          title="Refine today's task"
          onClose={closeModal}
        >
          <TaskForm
            values={form}
            setValues={setForm}
            submitLabel="Save changes"
            onSubmit={handleEdit}
            onCancel={closeModal}
          />
        </Modal>
      )}
      {modal === 'goal' && (
        <GoalModal
          progress={goalProgress}
          setProgress={setGoalProgress}
          onSave={handleGoal}
          onClose={closeModal}
        />
      )}
      {modal === 'auth' && (
        <AuthModal
          initialStep={authStep}
          inviteId={inviteContext?.id}
          inviteWorkspaceName={inviteContext?.workspaceName}
          prefillEmail={inviteContext?.invitedEmail ?? undefined}
          onClose={closeModal}
          onAuthenticated={handleAuthenticated}
        />
      )}
      {modal === 'migration' && (
        <MigrationModal
          taskCount={migrationTaskCount}
          onMigrate={handleMigrate}
          onKeepLocal={handleKeepLocal}
          onClose={closeModal}
        />
      )}
      {authReady && !user && (
        <GoogleOneTap
          enabled={modal !== 'auth'}
          onSignedIn={handleAuthenticated}
        />
      )}
      {settingsOpen && (
        <SettingsModal
          settings={settings}
          onSave={updateSettings}
          onReset={handleReset}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {completionTask && (
        <CompletionModal
          taskName={completionTask.name}
          onStop={() => setCompletionTask(null)}
        />
      )}
      {confirmation?.type === 'delete' && (
        <ConfirmModal
          title="Remove this task?"
          message="This will remove the task and its recorded time from today."
          confirmLabel="Remove task"
          onConfirm={confirmAction}
          onClose={closeConfirmation}
        />
      )}
      {confirmation?.type === 'reset' && (
        <ConfirmModal
          title="Clear local data?"
          message="This will permanently remove today's tasks and reset all OnTask settings from this browser."
          confirmLabel="Clear local data"
          onConfirm={confirmAction}
          onClose={closeConfirmation}
        />
      )}
      {confirmation?.type === 'delete-parent' && (
        <DeleteParentModal
          taskName={confirmation.task.name}
          childCount={confirmation.childCount}
          onDeleteAll={confirmDeleteParentAndChildren}
          onOrphan={confirmOrphanChildren}
          onClose={closeConfirmation}
        />
      )}
    </main>
  )
}
