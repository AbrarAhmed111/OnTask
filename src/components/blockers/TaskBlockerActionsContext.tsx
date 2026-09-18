'use client'

import { createContext, useContext } from 'react'
import type { TaskBlockerActions } from '@/hooks/useTaskBlockerActions'

// Blocking, editing and resolving change the TASK (its status, and for a running
// one its timer) as well as the blocker, and only the list that owns the task —
// the workspace queue, or one Goal's tree — can update it in place. So each of
// those lists provides its own actions here around the cards it renders, and a
// card reads them, instead of three more callbacks travelling through every
// list and parent card between the two. Same idea as how a card already reads
// the workspace itself from WorkspaceDetailContext.
export const TaskBlockerActionsContext =
  createContext<TaskBlockerActions | null>(null)

// null when no list provided any — cards then simply don't offer the actions.
export function useTaskBlockerActionsContext() {
  return useContext(TaskBlockerActionsContext)
}
