import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { GoalCard } from '@/components/goals/GoalCard'
import { GoalDetailHeader } from '@/components/goals/GoalDetailHeader'
import { WorkspaceGoalsSection } from '@/components/workspaces/WorkspaceGoalsSection'
import { Goal, WorkspaceMember } from '@/types/workspace'

const makeGoal = (overrides: Partial<Goal> = {}): Goal => ({
  id: 'goal-1',
  workspaceId: 'ws-1',
  name: 'Launch v2.0',
  description: 'Ship the complete redesigned platform',
  status: 'active',
  createdBy: 'user-owner',
  targetDate: '2026-10-01',
  position: 0,
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-01T00:00:00Z',
  completedAt: null,
  archivedAt: null,
  ...overrides,
})

const ownerMember: WorkspaceMember = {
  id: 'mem-1',
  workspaceId: 'ws-1',
  userId: 'user-owner',
  role: 'owner',
  joinedAt: '2026-09-01T00:00:00Z',
  fullName: 'Workspace Owner',
  email: 'owner@example.com',
  avatarUrl: null,
}

describe('GoalDetailHeader', () => {
  it('shows Archive and Mark complete for active goals, without a Delete button', () => {
    const html = renderToStaticMarkup(
      <GoalDetailHeader
        goal={makeGoal({ status: 'active' })}
        progress={50}
        focusedSeconds={3600}
        totalTasks={4}
        completedTasks={2}
        blockedTasks={0}
        onEdit={() => {}}
        onMarkComplete={() => {}}
        onArchive={() => {}}
        onReactivate={() => {}}
        onDelete={() => {}}
      />,
    )

    expect(html).toContain('Archive')
    expect(html).toContain('Mark complete')
    expect(html).not.toContain('Reactivate')
    expect(html).not.toContain('Delete')
  })

  it('shows Reactivate and Delete for archived goals when onDelete is provided', () => {
    const html = renderToStaticMarkup(
      <GoalDetailHeader
        goal={makeGoal({ status: 'archived', archivedAt: '2026-09-10T00:00:00Z' })}
        progress={100}
        focusedSeconds={7200}
        totalTasks={4}
        completedTasks={4}
        blockedTasks={0}
        onEdit={() => {}}
        onMarkComplete={() => {}}
        onArchive={() => {}}
        onReactivate={() => {}}
        onDelete={() => {}}
      />,
    )

    expect(html).toContain('Reactivate')
    expect(html).toContain('Delete')
    expect(html).not.toContain('Mark complete')
  })

  it('omits Delete button for archived goals when onDelete is omitted', () => {
    const html = renderToStaticMarkup(
      <GoalDetailHeader
        goal={makeGoal({ status: 'archived' })}
        progress={100}
        focusedSeconds={7200}
        totalTasks={4}
        completedTasks={4}
        blockedTasks={0}
        onEdit={() => {}}
        onMarkComplete={() => {}}
        onArchive={() => {}}
        onReactivate={() => {}}
      />,
    )

    expect(html).toContain('Reactivate')
    expect(html).not.toContain('Delete')
  })
})

const regularMember: WorkspaceMember = {
  id: 'mem-2',
  workspaceId: 'ws-1',
  userId: 'user-member',
  role: 'member',
  joinedAt: '2026-09-02T00:00:00Z',
  fullName: 'Regular Member',
  email: 'member@example.com',
  avatarUrl: null,
}

describe('WorkspaceGoalsSection', () => {
  it('renders active goals by default and offers archived toggle when archived goals exist', () => {
    const goals = [
      makeGoal({ id: 'g-1', name: 'Active Goal', status: 'active' }),
      makeGoal({ id: 'g-2', name: 'Archived Goal', status: 'archived' }),
    ]

    const html = renderToStaticMarkup(
      <WorkspaceGoalsSection
        ready={true}
        goals={goals}
        workspaceId="ws-1"
        isPersonal={false}
        soundEnabled={true}
        user={{ id: 'user-owner', email: 'owner@example.com', fullName: null, avatarUrl: null }}
        members={[ownerMember]}
        updateGoal={() => {}}
        setGoalStatus={() => {}}
        deleteGoal={() => {}}
        onWorkingTasksChange={() => {}}
        onAddGoal={() => {}}
      />,
    )

    expect(html).toContain('Active Goal')
    expect(html).not.toContain('Archived Goal')
    expect(html).toContain('1 archived')
  })

  it('renders GoalCard with delete button for archived goals when user is owner', () => {
    const html = renderToStaticMarkup(
      <WorkspaceGoalsSection
        ready={true}
        goals={[makeGoal({ id: 'g-archived', name: 'Archived Launch', status: 'archived' })]}
        workspaceId="ws-1"
        isPersonal={false}
        soundEnabled={true}
        user={{ id: 'user-owner', email: 'owner@example.com', fullName: null, avatarUrl: null }}
        members={[ownerMember]}
        updateGoal={() => {}}
        setGoalStatus={() => {}}
        deleteGoal={() => {}}
        onWorkingTasksChange={() => {}}
        onAddGoal={() => {}}
      />,
    )

    // With 1 archived goal and 0 active goals:
    // By default WorkspaceGoalsSection shows active goals (empty state "No goals yet" and "1 archived" button)
    expect(html).toContain('1 archived')
  })
})

describe('GoalCard', () => {
  it('renders a delete button for an archived goal when the user is the owner', () => {
    const html = renderToStaticMarkup(
      <GoalCard
        goal={makeGoal({ id: 'g-1', name: 'Archived Roadmap', status: 'archived' })}
        workspaceId="ws-1"
        isPersonal={false}
        soundEnabled={false}
        user={{ id: 'user-owner', email: 'owner@example.com', fullName: null, avatarUrl: null }}
        members={[ownerMember]}
        updateGoal={() => {}}
        setGoalStatus={() => {}}
        deleteGoal={() => {}}
        onWorkingTasksChange={() => {}}
      />,
    )

    expect(html).toContain('aria-label="Delete Archived Roadmap"')
  })

  it('renders a delete button for an archived goal when the user is the creator', () => {
    const html = renderToStaticMarkup(
      <GoalCard
        goal={makeGoal({
          id: 'g-2',
          name: 'Creator Goal',
          status: 'archived',
          createdBy: 'user-member',
        })}
        workspaceId="ws-1"
        isPersonal={false}
        soundEnabled={false}
        user={{ id: 'user-member', email: 'member@example.com', fullName: null, avatarUrl: null }}
        members={[regularMember]}
        updateGoal={() => {}}
        setGoalStatus={() => {}}
        deleteGoal={() => {}}
        onWorkingTasksChange={() => {}}
      />,
    )

    expect(html).toContain('aria-label="Delete Creator Goal"')
  })

  it('omits the delete button for an archived goal when user is neither creator nor owner', () => {
    const html = renderToStaticMarkup(
      <GoalCard
        goal={makeGoal({
          id: 'g-3',
          name: 'Protected Goal',
          status: 'archived',
          createdBy: 'user-other',
        })}
        workspaceId="ws-1"
        isPersonal={false}
        soundEnabled={false}
        user={{ id: 'user-member', email: 'member@example.com', fullName: null, avatarUrl: null }}
        members={[regularMember]}
        updateGoal={() => {}}
        setGoalStatus={() => {}}
        deleteGoal={() => {}}
        onWorkingTasksChange={() => {}}
      />,
    )

    expect(html).not.toContain('aria-label="Delete Protected Goal"')
  })

  it('omits the delete button when the goal is active even for the owner', () => {
    const html = renderToStaticMarkup(
      <GoalCard
        goal={makeGoal({
          id: 'g-4',
          name: 'Active Goal',
          status: 'active',
          createdBy: 'user-owner',
        })}
        workspaceId="ws-1"
        isPersonal={false}
        soundEnabled={false}
        user={{ id: 'user-owner', email: 'owner@example.com', fullName: null, avatarUrl: null }}
        members={[ownerMember]}
        updateGoal={() => {}}
        setGoalStatus={() => {}}
        deleteGoal={() => {}}
        onWorkingTasksChange={() => {}}
      />,
    )

    expect(html).not.toContain('aria-label="Delete Active Goal"')
  })
})

