import type {
  TaskBlocker,
  WorkspaceMember,
  WorkspaceTask,
} from '@/types/workspace'

// Who may do what with a task blocker. The database is what actually enforces
// this (supabase/migrations/0041_task_blockers.sql: block_workspace_task,
// update_task_blocker, resolve_task_blocker, can_resolve_task_blocker); this
// mirrors those rules so the UI can hide what would be refused and the hooks
// don't send requests that are certain to fail. Keep the two in step.
//
// Everything is decided from user ids and the task's CURRENT assignee — never a
// display name, and never who the assignee used to be.
//
//   create / edit  the task's current assignee. Blocking a running task stops
//                  its timer, and a timer is the assignee's alone.
//   resolve        the current assignee, or a member explicitly mentioned in
//                  the ACTIVE blocker — in both cases a current workspace
//                  member. The workspace owner gets no bypass, and neither does
//                  a previous assignee: reassigning moves the right with it.
//   see            every workspace member (visibility is not permission).

export type BlockerActor = {
  userId: string | undefined
  // Blockers exist for shared workspaces only.
  isPersonal: boolean
}

// A blocker can only be raised on a task that can still make progress: not one
// already blocked (one active blocker per task) and not one that's finished.
const BLOCKABLE_STATUSES: readonly WorkspaceTask['status'][] = [
  'queued',
  'working',
  'paused',
]

export function canBlockTask(
  task: Pick<WorkspaceTask, 'assignedTo' | 'status'>,
  actor: BlockerActor,
  // A task that groups subtasks has no timer or progress of its own to stop.
  hasSubtasks = false,
): boolean {
  return (
    Boolean(actor.userId) &&
    !actor.isPersonal &&
    !hasSubtasks &&
    task.assignedTo === actor.userId &&
    BLOCKABLE_STATUSES.includes(task.status)
  )
}

export function canEditBlocker(
  task: Pick<WorkspaceTask, 'assignedTo'>,
  blocker: Pick<TaskBlocker, 'status'>,
  actor: BlockerActor,
): boolean {
  return (
    Boolean(actor.userId) &&
    !actor.isPersonal &&
    blocker.status === 'active' &&
    task.assignedTo === actor.userId
  )
}

export function canResolveBlocker(
  task: Pick<WorkspaceTask, 'assignedTo'>,
  blocker: Pick<TaskBlocker, 'status' | 'mentionedUserIds'>,
  actor: BlockerActor,
  // Who is in the workspace right now. Being mentioned (or assigned) only
  // counts while still a member.
  memberUserIds: readonly string[],
): boolean {
  const { userId } = actor
  if (!userId || actor.isPersonal || blocker.status !== 'active') return false
  if (!memberUserIds.includes(userId)) return false
  return task.assignedTo === userId || blocker.mentionedUserIds.includes(userId)
}

// The people who can currently resolve this blocker — for telling everyone
// else who to ask. The assignee first, then the members it names, each once.
export function blockerResolvers(
  task: Pick<WorkspaceTask, 'assignedTo'>,
  blocker: Pick<TaskBlocker, 'mentionedUserIds'>,
  members: readonly WorkspaceMember[],
): WorkspaceMember[] {
  const ids = [
    ...(task.assignedTo ? [task.assignedTo] : []),
    ...blocker.mentionedUserIds,
  ]
  const seen = new Set<string>()
  return ids.flatMap(id => {
    if (seen.has(id)) return []
    seen.add(id)
    const member = members.find(m => m.userId === id)
    return member ? [member] : []
  })
}
