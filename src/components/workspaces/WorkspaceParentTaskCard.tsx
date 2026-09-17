'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, CirclePlus, Trash2 } from 'lucide-react'
import { WorkspaceMember, WorkspaceTask } from '@/types/workspace'
import { WorkspaceTaskCard } from '@/components/workspaces/WorkspaceTaskCard'

function AssigneeStack({ members }: { members: WorkspaceMember[] }) {
  const shown = members.slice(0, 3)
  const overflow = members.length - shown.length
  return (
    <div className="flex shrink-0 items-center">
      <div className="flex -space-x-1.5">
        {shown.map(member => (
          <span
            key={member.userId}
            title={member.fullName || member.email || 'Member'}
            className="grid h-5 w-5 place-items-center overflow-hidden rounded-full border-2 border-panel bg-[var(--ws-accent,#375b4b)] text-[8px] font-bold text-white"
          >
            {member.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={member.avatarUrl}
                alt=""
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            ) : (
              (member.fullName || member.email || '?').charAt(0).toUpperCase()
            )}
          </span>
        ))}
      </div>
      {overflow > 0 && (
        <span className="-ml-1.5 grid h-5 w-5 place-items-center rounded-full border-2 border-panel bg-slate-200 font-mono text-[8px] font-bold text-muted">
          +{overflow}
        </span>
      )}
    </div>
  )
}

export function WorkspaceParentTaskCard({
  parent,
  subtasks,
  members,
  getWorkedSeconds,
  onStart,
  onPause,
  onFinish,
  onEdit,
  onDelete,
  onReassign,
  onAddSubtask,
  onDeleteParent,
  moveOptions,
  onMoveTo,
}: {
  parent: WorkspaceTask
  subtasks: WorkspaceTask[]
  members: WorkspaceMember[]
  getWorkedSeconds: (task: WorkspaceTask) => number
  onStart: (id: string) => void
  onPause: (task: WorkspaceTask) => void
  onFinish: (task: WorkspaceTask) => void
  onEdit: (task: WorkspaceTask) => void
  onDelete: (id: string) => void
  onReassign: (id: string, userId: string | null) => void
  onAddSubtask: () => void
  onDeleteParent: () => void
  moveOptions: { id: string; name: string }[]
  onMoveTo: (taskId: string, parentId: string | null) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const completed = subtasks.filter(task => task.status === 'completed').length
  const skipped = subtasks.filter(task => task.status === 'skipped').length
  const remaining = subtasks.length - completed - skipped
  const focusedSeconds = subtasks.reduce(
    (total, task) => total + getWorkedSeconds(task),
    0,
  )
  const assignees = Array.from(
    new Map(
      subtasks
        .map(task => members.find(m => m.userId === task.assignedTo))
        .filter((m): m is WorkspaceMember => Boolean(m))
        .map(m => [m.userId, m] as const),
    ).values(),
  )

  return (
    <div className="rounded-2xl border border-line bg-panel shadow-sm">
      <div className="flex items-center gap-3 px-4 py-4 sm:px-5">
        <button
          type="button"
          onClick={() => setExpanded(open => !open)}
          aria-label={expanded ? 'Collapse subtasks' : 'Expand subtasks'}
          className="rounded-lg p-1 text-muted transition hover:bg-slate-100 hover:text-ink"
        >
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold tracking-tight text-ink">
            {parent.name}
          </h3>
          <p className="mt-1 text-[10px] text-muted">
            {completed} completed
            {skipped > 0 ? ` · ${skipped} skipped` : ''} · {remaining} remaining
            · {Math.round(focusedSeconds / 60)}m focused
          </p>
        </div>
        {assignees.length > 0 && <AssigneeStack members={assignees} />}
        <button
          onClick={onAddSubtask}
          className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[10px] font-semibold text-[var(--ws-accent,#375b4b)] transition hover:text-coral"
        >
          <CirclePlus size={13} /> Add subtask
        </button>
        <button
          aria-label={`Delete ${parent.name}`}
          onClick={onDeleteParent}
          className="rounded-lg p-2 text-muted transition hover:bg-coral/10 hover:text-coral"
        >
          <Trash2 size={15} />
        </button>
      </div>
      {expanded && (
        <div className="space-y-2 border-t border-line/70 px-4 py-4 sm:px-5">
          {subtasks.map(task => (
            <WorkspaceTaskCard
              key={task.id}
              task={task}
              workedSeconds={Math.round(getWorkedSeconds(task))}
              members={members}
              onStart={() => onStart(task.id)}
              onPause={() => onPause(task)}
              onFinish={() => onFinish(task)}
              onEdit={() => onEdit(task)}
              onDelete={() => onDelete(task.id)}
              onReassign={userId => onReassign(task.id, userId)}
              moveOptions={moveOptions}
              onMoveTo={parentId => onMoveTo(task.id, parentId)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
