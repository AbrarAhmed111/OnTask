import { describe, expect, it } from 'vitest'
import {
  PERSONAL_WORKSPACE_PATH,
  PERSONAL_WORKSPACE_SLUG,
  WorkspaceRow,
  isPersonalWorkspace,
  rowToWorkspace,
  workspacePath,
} from '@/lib/workspaces'

const baseRow: WorkspaceRow = {
  id: 'ws-1',
  slug: 'acme',
  type: 'shared',
  name: 'Acme',
  description: 'Team space',
  owner_id: 'user-1',
  timezone: 'UTC',
  report_time: '12:00:00',
  accent: 'forest',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

describe('rowToWorkspace', () => {
  it('keeps a shared workspace on its own slug', () => {
    const workspace = rowToWorkspace(baseRow)
    expect(workspace.slug).toBe('acme')
    expect(workspace.type).toBe('shared')
    expect(workspacePath(workspace)).toBe('/workspaces/acme')
  })

  it('addresses a personal workspace by the shared alias, not its stored slug', () => {
    const workspace = rowToWorkspace({
      ...baseRow,
      type: 'personal',
      slug: 'personal-0f3c9a2b7d1e4c5a8b6d9e0f1a2b3c4d',
      name: 'Personal Workspace',
    })
    expect(workspace.slug).toBe(PERSONAL_WORKSPACE_SLUG)
    expect(workspacePath(workspace)).toBe(PERSONAL_WORKSPACE_PATH)
    expect(workspace.type).toBe('personal')
  })

  it('maps the remaining columns', () => {
    const workspace = rowToWorkspace(baseRow)
    expect(workspace).toMatchObject({
      id: 'ws-1',
      ownerId: 'user-1',
      reportTime: '12:00:00',
      description: 'Team space',
    })
  })
})

describe('isPersonalWorkspace', () => {
  it('is true only for personal workspaces', () => {
    expect(isPersonalWorkspace({ type: 'personal' })).toBe(true)
    expect(isPersonalWorkspace({ type: 'shared' })).toBe(false)
    expect(isPersonalWorkspace(null)).toBe(false)
    expect(isPersonalWorkspace(undefined)).toBe(false)
  })
})
