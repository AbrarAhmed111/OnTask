'use client'

import { BlockerDialog } from '@/components/blockers/BlockerDialog'
import { ResolveBlockerDialog } from '@/components/blockers/ResolveBlockerDialog'
import { useTaskBlockerActionsContext } from '@/components/blockers/TaskBlockerActionsContext'
import { showSuccessToast } from '@/lib/toast'
import type { AuthUser } from '@/hooks/useAuth'
import type {
  TaskBlocker,
  WorkspaceMember,
  WorkspaceTask,
} from '@/types/workspace'

export type BlockerDialogKind = 'block' | 'edit' | 'resolve'

// Whichever blocker dialog a task card has open. The card keeps only "which
// one" (a single piece of state); what each dialog submits, and the message
// afterwards, live here so the card stays a card.
export function BlockerDialogs({
  kind,
  task,
  blocker,
  members,
  user,
  onClose,
}: {
  kind: BlockerDialogKind | null
  task: WorkspaceTask
  blocker: TaskBlocker | undefined
  members: WorkspaceMember[]
  user: AuthUser | null
  onClose: () => void
}) {
  const actions = useTaskBlockerActionsContext()
  if (!kind || !actions) return null

  if (kind === 'block') {
    return (
      <BlockerDialog
        taskName={task.name}
        members={members}
        actorId={user?.id}
        onSubmit={input => {
          if (actions.block(task, input)) showSuccessToast('Task blocked.')
          onClose()
        }}
        onClose={onClose}
      />
    )
  }

  // Edit and resolve both act on the active blocker; if it's gone (someone
  // resolved it while this was open) there's nothing left to show.
  if (!blocker) return null

  if (kind === 'edit') {
    return (
      <BlockerDialog
        taskName={task.name}
        members={members}
        actorId={user?.id}
        initial={{
          reason: blocker.reason,
          mentionedMembers: blocker.mentionedUserIds.flatMap(id => {
            const member = members.find(m => m.userId === id)
            return member ? [member] : []
          }),
        }}
        onSubmit={input => {
          if (actions.update(task, blocker, input))
            showSuccessToast('Blocker updated.')
          onClose()
        }}
        onClose={onClose}
      />
    )
  }

  return (
    <ResolveBlockerDialog
      taskName={task.name}
      reason={blocker.reason}
      onSubmit={note => {
        if (actions.resolve(task, blocker, note))
          showSuccessToast('Blocker resolved. The task is back in the queue.')
        onClose()
      }}
      onClose={onClose}
    />
  )
}
