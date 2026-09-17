'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, CirclePlus, Trash2 } from 'lucide-react'
import { Task } from '@/types'
import { TaskCard } from '@/components/dashboard/TaskCard'

// Parents are containers, not runnable — no Start button anywhere on this
// card. Progress is always shown as counts (never a bare percentage) so
// skipped work stays visible rather than silently folding into "completed".
export function ParentTaskCard({
  parent,
  subtasks,
  getWorkedSeconds,
  onStart,
  onPause,
  onFinish,
  onEdit,
  onDelete,
  onRestart,
  onUpdateGoal,
  onAddSubtask,
  onDeleteParent,
  moveOptions,
  onMoveTo,
}: {
  parent: Task
  subtasks: Task[]
  getWorkedSeconds: (task: Task) => number
  onStart: (id: string) => void
  onPause: (task: Task) => void
  onFinish: (task: Task) => void
  onEdit: (task: Task) => void
  onDelete: (id: string) => void
  onRestart: (task: Task) => void
  onUpdateGoal: (task: Task) => void
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
        <button
          onClick={onAddSubtask}
          className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[10px] font-semibold text-forest transition hover:text-coral"
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
            <TaskCard
              key={task.id}
              task={task}
              workedSeconds={Math.round(getWorkedSeconds(task))}
              onStart={() => onStart(task.id)}
              onPause={() => onPause(task)}
              onFinish={() => onFinish(task)}
              onEdit={() => onEdit(task)}
              onDelete={() => onDelete(task.id)}
              onRestart={() => onRestart(task)}
              onUpdateGoal={() => onUpdateGoal(task)}
              moveOptions={moveOptions}
              onMoveTo={parentId => onMoveTo(task.id, parentId)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
