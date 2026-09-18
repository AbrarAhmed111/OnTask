import { useState } from 'react'
import { AlertTriangle, Archive, CirclePlus, Target } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { GoalCard } from '@/components/goals/GoalCard'
import { Goal, WorkspaceMember, WorkspaceTask } from '@/types/workspace'
import type { AuthUser } from '@/hooks/useAuth'

export function WorkspaceGoalsSection({
  ready,
  error,
  goals,
  workspaceId,
  user,
  members,
  updateGoal,
  setGoalStatus,
  onWorkingTasksChange,
  onAddGoal,
}: {
  ready: boolean
  error?: string | null
  goals: Goal[]
  workspaceId: string
  user: AuthUser | null
  members: WorkspaceMember[]
  updateGoal: (
    id: string,
    update: Partial<
      Pick<Goal, 'name' | 'description' | 'targetDate' | 'status'>
    >,
  ) => void
  setGoalStatus: (id: string, status: Goal['status']) => void
  onWorkingTasksChange: (goalId: string, tasks: WorkspaceTask[]) => void
  onAddGoal: () => void
}) {
  const [showArchived, setShowArchived] = useState(false)
  const archivedCount = goals.filter(goal => goal.status === 'archived').length
  const visibleGoals = goals.filter(goal =>
    showArchived ? goal.status === 'archived' : goal.status !== 'archived',
  )

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold tracking-tight text-ink">
          <Target size={15} className="text-[var(--ws-accent,#375b4b)]" />
          Goals
        </h2>
        <div className="flex items-center gap-3">
          {archivedCount > 0 && (
            <button
              onClick={() => setShowArchived(open => !open)}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-muted transition hover:text-ink"
            >
              <Archive size={12} />
              {showArchived ? 'Show active' : `${archivedCount} archived`}
            </button>
          )}
          <Button onClick={onAddGoal}>
            <CirclePlus size={15} /> New goal
          </Button>
        </div>
      </div>

      {ready && error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-coral/20 bg-coral/5 p-3 text-xs leading-5 text-coral">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!ready ? (
        <div className="space-y-3">
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-16 rounded-2xl" />
        </div>
      ) : visibleGoals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-sage/70 px-5 py-10 text-center">
          <Target size={22} className="mx-auto text-sage" />
          <p className="mt-3 text-xs font-semibold text-ink">
            {showArchived ? 'No archived goals' : 'No goals yet'}
          </p>
          {!showArchived && (
            <p className="mx-auto mt-1 max-w-xs text-[11px] leading-5 text-muted">
              Goals group related tasks and subtasks toward a bigger outcome —
              create one when work needs more structure than a single task.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {visibleGoals.map(goal => (
            <GoalCard
              key={goal.id}
              goal={goal}
              workspaceId={workspaceId}
              user={user}
              members={members}
              updateGoal={updateGoal}
              setGoalStatus={setGoalStatus}
              onWorkingTasksChange={onWorkingTasksChange}
            />
          ))}
        </div>
      )}
    </div>
  )
}
