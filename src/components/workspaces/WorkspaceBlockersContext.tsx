'use client'

import { ReactNode, createContext, useContext } from 'react'
import type { AuthUser } from '@/hooks/useAuth'
import {
  BlockerStore,
  useWorkspaceBlockers,
} from '@/hooks/useWorkspaceBlockers'
import type { TaskBlocker } from '@/types/workspace'

// The workspace's active blockers, fetched and subscribed once in the layout —
// like WorkspaceDetailContext — so a task card anywhere on the page (the flat
// queue, a Goal's task tree, a subtask) can look its own blocker up by task id
// without every list between it and the page passing blockers down.
export type WorkspaceBlockersContextValue = {
  blockers: TaskBlocker[]
  ready: boolean
  error: string | null
  blockerForTask: (taskId: string) => TaskBlocker | undefined
  // Only the task action hooks touch this (see useTaskBlockerActions).
  store: BlockerStore
}

const WorkspaceBlockersContext =
  createContext<WorkspaceBlockersContextValue | null>(null)

export function WorkspaceBlockersProvider({
  workspaceId,
  user,
  enabled,
  children,
}: {
  workspaceId: string
  user: AuthUser | null
  enabled: boolean
  children: ReactNode
}) {
  const value = useWorkspaceBlockers(workspaceId, user, enabled)
  return (
    <WorkspaceBlockersContext.Provider value={value}>
      {children}
    </WorkspaceBlockersContext.Provider>
  )
}

// null outside a shared workspace's layout (the guest page, a test): callers
// treat that as "no blockers exist here".
export function useOptionalWorkspaceBlockers() {
  return useContext(WorkspaceBlockersContext)
}

// The active blocker on one task, if any.
export function useTaskBlocker(taskId: string): TaskBlocker | undefined {
  return useContext(WorkspaceBlockersContext)?.blockerForTask(taskId)
}

// Test seam: renders children with a fixed set of blockers, no network.
export function StaticBlockersProvider({
  blockers,
  children,
}: {
  blockers: TaskBlocker[]
  children: ReactNode
}) {
  const value: WorkspaceBlockersContextValue = {
    blockers,
    ready: true,
    error: null,
    blockerForTask: taskId => blockers.find(b => b.taskId === taskId),
    store: NOOP_STORE,
  }
  return (
    <WorkspaceBlockersContext.Provider value={value}>
      {children}
    </WorkspaceBlockersContext.Provider>
  )
}

const NOOP_STORE: BlockerStore = {
  snapshot: () => ({ blocker: undefined, mentions: [] }),
  applyBlocker: () => {},
  addOptimistic: () => {},
  removeBlocker: () => {},
  markResolved: () => {},
  patchReason: () => {},
  patchMentions: () => {},
  restoreBlocker: () => {},
}
