'use client'

import { createContext, useContext, useEffect } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

// A task the page was asked to bring into view — by a notification's link
// (`/workspaces/<slug>?task=<id>`). `at` makes every request a new value, so
// following the same link twice scrolls twice.
export type TaskFocus = { id: string; at: number }

// How long after being asked a card still answers. A card can mount well after
// the request (a Goal only loads its tasks once it's on screen, a slow network
// loads them late); past this a stale request must not yank the page around.
const FOCUS_WINDOW_MS = 15_000

const FocusedTaskContext = createContext<TaskFocus | null>(null)

export const FocusedTaskProvider = FocusedTaskContext.Provider

const isFresh = (focus: TaskFocus) => Date.now() - focus.at < FOCUS_WINDOW_MS

// The request, if it is for this task and still fresh.
export function useTaskFocus(taskId: string): TaskFocus | null {
  const focus = useContext(FocusedTaskContext)
  return focus && focus.id === taskId && isFresh(focus) ? focus : null
}

// The current request for any task, if still fresh — for a container (a Goal)
// deciding whether the task it holds needs it to open.
export function useAnyTaskFocus(): TaskFocus | null {
  const focus = useContext(FocusedTaskContext)
  return focus && isFresh(focus) ? focus : null
}

// Reads `?task=` and hands it up once, then removes it from the URL so the page
// reads cleanly and following the same link again is a new request. Renders
// nothing; it exists to keep `useSearchParams` (which opts its nearest Suspense
// boundary out of static rendering) inside a boundary of its own — mount it
// under <Suspense fallback={null}>.
export function TaskFocusFromUrl({
  onFocus,
}: {
  onFocus: (focus: TaskFocus) => void
}) {
  const params = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const taskId = params.get('task')

  useEffect(() => {
    if (!taskId) return
    onFocus({ id: taskId, at: Date.now() })
    router.replace(pathname, { scroll: false })
  }, [taskId, onFocus, pathname, router])

  return null
}
