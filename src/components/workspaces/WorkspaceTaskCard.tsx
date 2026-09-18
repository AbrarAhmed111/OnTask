'use client'

import { useState } from 'react'
import {
  CirclePlus,
  Link2,
  MessageSquare,
  Pause,
  Play,
  Square,
} from 'lucide-react'
import { WorkspaceMember, WorkspaceTask } from '@/types/workspace'
import {
  canControlTimer,
  canEmergencyStop,
  timerLockReason,
} from '@/lib/tasks/timerPermissions'
import { tourAnchor } from '@/lib/tourAnchors'
import { Button } from '@/components/ui/Button'
import { AssigneePicker } from '@/components/workspaces/AssigneePicker'
import { useOptionalWorkspaceDetail } from '@/components/workspaces/WorkspaceDetailContext'
import {
  TASK_CHIP_CLASS,
  TaskCardShell,
  TaskDragProps,
} from '@/components/tasks/TaskCardShell'
import {
  TaskMoveOption,
  TaskMoveSelect,
} from '@/components/tasks/TaskMoveSelect'
import { TaskNotesPanel } from '@/components/tasks/TaskNotesPanel'
import type { AuthUser } from '@/hooks/useAuth'

// A workspace task (shared or personal, flat or inside a Goal). The card frame
// is shared with the guest's local tasks (TaskCardShell); what's specific to a
// workspace task lives here: assignment, shared notes, dependencies, and the
// timer permission rules.
export function WorkspaceTaskCard({
  task,
  index,
  workedSeconds,
  members,
  user,
  onStart,
  onPause,
  onEmergencyStop,
  onFinish,
  onEdit,
  onDelete,
  onAddSubtask,
  onReassign,
  moveOptions,
  onMoveTo,
  drag,
  blockedBy,
  onManageDependencies,
}: {
  task: WorkspaceTask
  index?: number
  workedSeconds: number
  members: WorkspaceMember[]
  user: AuthUser | null
  onStart: () => void
  onPause: () => void
  // Owner-only: stops someone else's running timer (never starts one).
  onEmergencyStop?: () => void
  onFinish: () => void
  onEdit: () => void
  onDelete: () => void
  onAddSubtask?: () => void
  onReassign: (userId: string | null) => void
  moveOptions?: TaskMoveOption[]
  onMoveTo?: (parentId: string | null) => void
  drag?: TaskDragProps
  // Only meaningful for a goal task (see GoalCard/DependencyPicker)
  // — flat tasks never have dependencies, so both stay undefined there.
  blockedBy?: string[]
  onManageDependencies?: () => void
}) {
  const [notesOpen, setNotesOpen] = useState(false)
  const completed = task.status === 'completed' || task.status === 'skipped'
  const blocked = Boolean(blockedBy && blockedBy.length > 0) && !completed
  const running = task.status === 'working'
  const statusLabel = blocked
    ? 'Blocked'
    : running
      ? 'In focus'
      : completed
        ? task.status === 'skipped'
          ? 'Skipped'
          : 'Complete'
        : task.status === 'paused'
          ? 'Paused'
          : 'Queued'
  const assignee = members.find(member => member.userId === task.assignedTo)
  // Timer permissions are a workspace-level fact (who's the owner, is this the
  // personal workspace), so they're read from the surrounding workspace rather
  // than threaded through every list and card between here and the page.
  const workspaceDetail = useOptionalWorkspaceDetail()
  // Nobody else to hand a task to in a personal workspace.
  const isPersonal = workspaceDetail?.isPersonal ?? false
  // Only the task's current assignee drives its timer; the owner gets a
  // separate, stop-only override for someone else's running one. The server
  // enforces the same rules — this just hides what it would reject.
  const timerActor = {
    userId: user?.id,
    isPersonal,
    isOwner: workspaceDetail?.isOwner ?? false,
  }
  const canTimer = canControlTimer(task, timerActor)
  const canStop = canEmergencyStop(task, timerActor)

  return (
    <TaskCardShell
      title={task.name}
      index={index}
      tone={running ? 'running' : completed ? 'done' : 'idle'}
      blocked={blocked}
      statusLabel={statusLabel}
      focusLabel="Focused time"
      workedSeconds={workedSeconds}
      plannedMinutes={task.plannedMinutes}
      progressLabel={task.progressLabel}
      progressPercentage={task.progressPercentage}
      drag={drag}
      onEdit={onEdit}
      onDelete={onDelete}
      leading={
        <>
          {!isPersonal && (
            <AssigneePicker
              assignee={assignee}
              members={members}
              onReassign={onReassign}
            />
          )}
          {onMoveTo && (
            <TaskMoveSelect
              taskName={task.name}
              parentTaskId={task.parentTaskId}
              options={moveOptions}
              onMove={onMoveTo}
            />
          )}
        </>
      }
      actions={
        <>
          {onAddSubtask && (
            <button onClick={onAddSubtask} className={TASK_CHIP_CLASS}>
              <CirclePlus size={13} /> Subtask
            </button>
          )}
          {onManageDependencies && (
            <button onClick={onManageDependencies} className={TASK_CHIP_CLASS}>
              <Link2 size={13} />
              Dependencies
              {blockedBy && blockedBy.length > 0
                ? ` (${blockedBy.length})`
                : ''}
            </button>
          )}
          <button
            {...tourAnchor('task-notes')}
            onClick={() => setNotesOpen(open => !open)}
            className={TASK_CHIP_CLASS}
          >
            <MessageSquare size={13} /> Notes
          </button>
          {/* Finishing a running task stops its timer, so it needs the same
              permission as Pause; finishing an idle one is open to anyone. */}
          {!completed && (canTimer || !running) && (
            <button onClick={onFinish} className={TASK_CHIP_CLASS}>
              Finish
            </button>
          )}
          {!completed && canTimer && (
            <Button
              variant={running ? 'danger' : 'primary'}
              onClick={running ? onPause : onStart}
              disabled={blocked}
              title={
                blocked ? 'Blocked by an incomplete dependency' : undefined
              }
            >
              {running ? (
                <>
                  <Pause size={15} /> Pause
                </>
              ) : (
                <>
                  <Play size={15} />{' '}
                  {task.status === 'paused' ? 'Resume' : 'Start'}
                </>
              )}
            </Button>
          )}
          {!completed && !canTimer && !running && (
            <Button
              disabled
              title={timerLockReason(task, timerActor) ?? undefined}
            >
              <Play size={15} /> {task.status === 'paused' ? 'Resume' : 'Start'}
            </Button>
          )}
          {canStop && onEmergencyStop && (
            <Button
              variant="danger"
              onClick={onEmergencyStop}
              title="Stop this timer. The time already recorded is kept and the task stays assigned."
            >
              <Square size={14} /> Emergency stop
            </Button>
          )}
        </>
      }
    >
      {blocked && (
        <p className="rounded-lg border border-coral/20 bg-coral/5 px-3 py-2 text-[11px] font-semibold text-coral">
          Blocked by: {blockedBy!.join(', ')}
        </p>
      )}

      {notesOpen && (
        <TaskNotesPanel taskId={task.id} user={user} members={members} />
      )}
    </TaskCardShell>
  )
}
