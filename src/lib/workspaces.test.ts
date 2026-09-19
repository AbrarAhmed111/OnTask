import { describe, expect, it } from 'vitest'
import {
  PERSONAL_WORKSPACE_PATH,
  PERSONAL_WORKSPACE_SLUG,
  WorkspaceRow,
  isPersonalWorkspace,
  rowToWorkspace,
  workspacePatchToRow,
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
  daily_reports_enabled: true,
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

describe('rowToWorkspace: Daily Reports setting', () => {
  it('reads the stored switch, for either kind of workspace', () => {
    expect(rowToWorkspace(baseRow).dailyReportsEnabled).toBe(true)
    expect(
      rowToWorkspace({ ...baseRow, daily_reports_enabled: false })
        .dailyReportsEnabled,
    ).toBe(false)
    expect(
      rowToWorkspace({
        ...baseRow,
        type: 'personal',
        daily_reports_enabled: true,
      }).dailyReportsEnabled,
    ).toBe(true)
  })

  it('falls back to the product default when the column does not exist yet', () => {
    const { daily_reports_enabled: _omitted, ...withoutColumn } = baseRow
    void _omitted
    // a shared workspace has always had reports; a personal one is opt-in
    expect(rowToWorkspace(withoutColumn).dailyReportsEnabled).toBe(true)
    expect(
      rowToWorkspace({ ...withoutColumn, type: 'personal' })
        .dailyReportsEnabled,
    ).toBe(false)
  })
})

describe('workspacePatchToRow', () => {
  it('saves the Daily Reports switch as its own column and nothing else', () => {
    expect(workspacePatchToRow({ dailyReportsEnabled: false })).toEqual({
      daily_reports_enabled: false,
    })
    expect(workspacePatchToRow({ dailyReportsEnabled: true })).toEqual({
      daily_reports_enabled: true,
    })
  })

  it('does not rewrite settings that were not part of the change', () => {
    expect(workspacePatchToRow({ name: 'Renamed' })).toEqual({
      name: 'Renamed',
    })
    expect(workspacePatchToRow({})).toEqual({})
  })

  it('maps every editable field to its column', () => {
    expect(
      workspacePatchToRow({
        name: 'A',
        description: null,
        timezone: 'UTC',
        reportTime: '09:00:00',
        accent: 'ocean',
        dailyReportsEnabled: true,
      }),
    ).toEqual({
      name: 'A',
      description: null,
      timezone: 'UTC',
      report_time: '09:00:00',
      accent: 'ocean',
      daily_reports_enabled: true,
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
