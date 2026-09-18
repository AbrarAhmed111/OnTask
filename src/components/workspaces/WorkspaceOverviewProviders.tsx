'use client'

import { ReactNode, Suspense, useState } from 'react'
import { useWorkspaceDetail } from '@/components/workspaces/WorkspaceDetailContext'
import { WorkspaceBlockersProvider } from '@/components/workspaces/WorkspaceBlockersContext'
import {
  FocusedTaskProvider,
  TaskFocus,
  TaskFocusFromUrl,
} from '@/components/workspaces/FocusedTaskContext'

// What the overview's task cards read from context. Both are specific to the
// overview — that is the only page with task cards — so, like the tasks, goals
// and activity it fetches for itself, they are mounted here rather than in the
// shared workspace layout, where the Members and Settings pages would pay for a
// realtime subscription they never use.
//
//   - the workspace's active blockers, fetched once and subscribed to live, so
//     any card (flat queue, a Goal's tasks, a subtask) can look up its own;
//     none at all for a personal workspace, which has nobody to wait on;
//   - a notification's request to bring one task into view (`?task=<id>`).
export function WorkspaceOverviewProviders({
  children,
}: {
  children: ReactNode
}) {
  const { workspaceId, user, isPersonal } = useWorkspaceDetail()
  const [taskFocus, setTaskFocus] = useState<TaskFocus | null>(null)

  return (
    <WorkspaceBlockersProvider
      workspaceId={workspaceId}
      user={user}
      enabled={!isPersonal}
    >
      <FocusedTaskProvider value={taskFocus}>
        {/* `useSearchParams` opts its nearest Suspense boundary out of static
            rendering, so it gets one of its own around a component that renders
            nothing. */}
        <Suspense fallback={null}>
          <TaskFocusFromUrl onFocus={setTaskFocus} />
        </Suspense>
        {children}
      </FocusedTaskProvider>
    </WorkspaceBlockersProvider>
  )
}
