import { OctagonAlert } from 'lucide-react'
import { mentionLabel } from '@/lib/mentions'
import type {
  TaskBlocker,
  WorkspaceMember,
  WorkspaceTask,
} from '@/types/workspace'

export type BlockedNowItem = {
  task: WorkspaceTask
  // The Goal a Goal task belongs to (flat tasks have none).
  goalName?: string
  blocker: TaskBlocker
}

// Stuck work, next to "Working now": which tasks can't move, why, and who is
// being asked. Deliberately small — one line of reason per task, no counts, no
// ageing, no ranking; it exists so stuck work is visible, not to be a board.
// Renders nothing when nothing is blocked.
export function BlockedNowPanel({
  items,
  members,
  isPersonal = false,
}: {
  items: BlockedNowItem[]
  members: readonly WorkspaceMember[]
  isPersonal?: boolean
}) {
  if (items.length === 0) return null

  const nameOf = (userId: string | null) => {
    if (isPersonal) return 'You'
    const member = members.find(m => m.userId === userId)
    return member ? mentionLabel(member) : 'Someone'
  }

  return (
    <section
      aria-label="Blocked tasks"
      className="mb-6 rounded-2xl border border-coral/25 bg-coral/5 p-5 sm:p-6"
    >
      <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.1em] text-coral">
        <OctagonAlert size={14} aria-hidden="true" /> Blocked
      </h2>
      <ul className="space-y-2">
        {items.map(({ task, goalName, blocker }) => {
          const waitingOn = blocker.mentionedUserIds.map(id => nameOf(id))
          return (
            <li
              key={task.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-line bg-panel px-4 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-ink">
                  {task.name}
                </p>
                {goalName && (
                  <p className="truncate text-[10px] text-muted">
                    Goal: {goalName}
                  </p>
                )}
                <p className="mt-0.5 line-clamp-2 whitespace-pre-line break-words text-[11px] leading-4 text-muted">
                  {blocker.reason}
                </p>
                {waitingOn.length > 0 && (
                  <p className="mt-0.5 truncate text-[10px] font-semibold text-muted">
                    Waiting on {waitingOn.join(', ')}
                  </p>
                )}
              </div>
              <p className="shrink-0 text-[11px] text-muted">
                {nameOf(task.assignedTo)}
              </p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
