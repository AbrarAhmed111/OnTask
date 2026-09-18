'use client'

import { useState } from 'react'
import { Link2, X } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { TaskDependency, WorkspaceTask } from '@/types/workspace'

// Manages what blocks a single goal task ("Task A blocks Task B") — kept to
// the doc's own scope: pick a blocker, remove a blocker, nothing else
// (no scheduling, no graph view). Cycle prevention is enforced server-side
// (add_task_dependency); this UI just excludes the obviously-invalid
// self-reference from the picker.
export function DependencyPicker({
  task,
  allTasks,
  dependencies,
  onAdd,
  onRemove,
  onClose,
}: {
  task: WorkspaceTask
  allTasks: WorkspaceTask[]
  dependencies: TaskDependency[]
  onAdd: (blockingTaskId: string) => void
  onRemove: (dependencyId: string) => void
  onClose: () => void
}) {
  const [selected, setSelected] = useState('')
  const blockers = dependencies.filter(dep => dep.blockedTaskId === task.id)
  const blockerIds = new Set(blockers.map(dep => dep.blockingTaskId))
  const candidates = allTasks.filter(
    other => other.id !== task.id && !blockerIds.has(other.id),
  )
  const taskById = new Map(allTasks.map(other => [other.id, other]))

  const handleAdd = () => {
    if (!selected) return
    onAdd(selected)
    setSelected('')
  }

  return (
    <Modal
      eyebrow="Dependencies"
      title={`What blocks "${task.name}"?`}
      onClose={onClose}
    >
      <div className="space-y-4">
        {blockers.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-xs text-muted">
            No dependencies yet — this task is ready to work on.
          </p>
        ) : (
          <ul className="space-y-2">
            {blockers.map(dep => {
              const blocker = taskById.get(dep.blockingTaskId)
              const done =
                blocker?.status === 'completed' || blocker?.status === 'skipped'
              return (
                <li
                  key={dep.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-line bg-white/60 px-3 py-2"
                >
                  <span className="flex min-w-0 items-center gap-2 text-xs font-semibold text-ink">
                    <Link2
                      size={13}
                      className={done ? 'text-sage' : 'text-coral'}
                    />
                    <span className="truncate">
                      {blocker?.name ?? 'Deleted task'}
                    </span>
                    {done && (
                      <span className="shrink-0 text-[10px] font-normal text-muted">
                        (done)
                      </span>
                    )}
                  </span>
                  <button
                    aria-label={`Remove dependency on ${blocker?.name ?? 'this task'}`}
                    onClick={() => onRemove(dep.id)}
                    className="shrink-0 rounded-lg p-1.5 text-muted transition hover:bg-coral/10 hover:text-coral"
                  >
                    <X size={14} />
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {candidates.length > 0 && (
          <div className="flex items-center gap-2 border-t border-line pt-4">
            <select
              value={selected}
              onChange={event => setSelected(event.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-sage focus:ring-4 focus:ring-sage/15"
            >
              <option value="">Choose a task that must finish first…</option>
              {candidates.map(candidate => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </option>
              ))}
            </select>
            <Button type="button" onClick={handleAdd} disabled={!selected}>
              Add
            </Button>
          </div>
        )}
      </div>
    </Modal>
  )
}
