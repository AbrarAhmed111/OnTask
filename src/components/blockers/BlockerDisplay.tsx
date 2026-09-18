import { OctagonAlert, Pencil } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { blockerResolvers } from '@/lib/tasks/blockerPermissions'
import { mentionLabel } from '@/lib/mentions'
import { timeAgo } from '@/lib/time'
import type {
  TaskBlocker,
  WorkspaceMember,
  WorkspaceTask,
} from '@/types/workspace'

// The active blocker on a task card: that it is blocked, why, who is being
// asked to help, and — only when the viewer is allowed — the Resolve action.
//
// Everyone in the workspace sees all of it. Whether the buttons appear is a
// separate question, answered by the caller from the resolve/edit rules
// (lib/tasks/blockerPermissions.ts); when the viewer can't resolve, a line says
// who can, so a missing button never looks like a bug. "Blocked" is spelled out
// next to the icon (and read out by screen readers) rather than left to the
// colour.
export function BlockerDisplay({
  task,
  blocker,
  members,
  canResolve,
  canEdit,
  onResolve,
  onEdit,
}: {
  task: Pick<WorkspaceTask, 'assignedTo' | 'name'>
  blocker: TaskBlocker
  members: readonly WorkspaceMember[]
  canResolve: boolean
  canEdit: boolean
  onResolve: () => void
  onEdit: () => void
}) {
  const mentioned = blocker.mentionedUserIds.flatMap(id => {
    const member = members.find(m => m.userId === id)
    return member ? [member] : []
  })
  const author = members.find(m => m.userId === blocker.createdBy)
  const resolvers = blockerResolvers(task, blocker, members)

  return (
    <section
      aria-label={`Blocker on ${task.name}`}
      className="rounded-lg border border-coral/25 bg-coral/5 px-3 py-2.5"
    >
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-coral">
        <OctagonAlert size={13} aria-hidden="true" /> Blocked
        <span className="sr-only">: this task cannot continue.</span>
      </p>
      <p className="mt-1.5 whitespace-pre-wrap break-words text-xs leading-5 text-ink">
        {blocker.reason}
      </p>

      {mentioned.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-semibold text-muted">
            Waiting on
          </span>
          {mentioned.map(member => (
            <span
              key={member.userId}
              className="flex items-center gap-1 rounded-full border border-line bg-white/70 py-0.5 pl-0.5 pr-2"
            >
              <Avatar
                person={member}
                className="h-[18px] w-[18px] text-[8px]"
              />
              <span className="max-w-[140px] truncate text-[11px] font-semibold text-ink">
                {mentionLabel(member)}
              </span>
            </span>
          ))}
        </div>
      )}

      <p className="mt-2 text-[10px] leading-4 text-muted">
        Reported by {author ? mentionLabel(author) : 'a former member'} ·{' '}
        {timeAgo(blocker.createdAt)}
      </p>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {canResolve && (
          <Button type="button" variant="primary" onClick={onResolve}>
            Resolve blocker
          </Button>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1.5 text-[10px] font-semibold text-muted transition hover:border-[var(--ws-accent,#375b4b)] hover:text-[var(--ws-accent,#375b4b)]"
          >
            <Pencil size={11} aria-hidden="true" /> Edit blocker
          </button>
        )}
        {!canResolve && resolvers.length > 0 && (
          <p className="text-[10px] leading-4 text-muted">
            Only {joinNames(resolvers.map(mentionLabel))} can resolve this.
          </p>
        )}
      </div>
    </section>
  )
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  if (names.length === 2) return `${names[0]} or ${names[1]}`
  return `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`
}
