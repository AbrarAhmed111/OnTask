import { Workspace, WorkspaceType } from '@/types/workspace'

// Every user's Personal Workspace lives at the same URL:
// /workspaces/personal-workspace. It's an alias, not the row's stored slug
// (that one embeds the owner's id so the global UNIQUE(slug) still holds) —
// the app resolves the alias to "the signed-in user's own personal
// workspace", so one user can never reach another's by editing the URL.
export const PERSONAL_WORKSPACE_SLUG = 'personal-workspace'
export const PERSONAL_WORKSPACE_PATH = `/workspaces/${PERSONAL_WORKSPACE_SLUG}`
// What the UI calls it, wherever it's shown next to shared workspaces' names.
export const PERSONAL_WORKSPACE_NAME = 'Personal Workspace'

export type WorkspaceRow = {
  id: string
  slug: string
  type: WorkspaceType
  name: string
  description: string | null
  owner_id: string
  timezone: string
  report_time: string
  accent: string
  created_at: string
  updated_at: string
}

export function rowToWorkspace(row: WorkspaceRow): Workspace {
  return {
    id: row.id,
    // Personal workspaces are always addressed by the alias, everywhere a
    // link or route is built from `workspace.slug`.
    slug: row.type === 'personal' ? PERSONAL_WORKSPACE_SLUG : row.slug,
    type: row.type,
    name: row.name,
    description: row.description,
    ownerId: row.owner_id,
    timezone: row.timezone,
    reportTime: row.report_time,
    accent: row.accent,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function isPersonalWorkspace(
  workspace: Pick<Workspace, 'type'> | null | undefined,
) {
  return workspace?.type === 'personal'
}

// The path a workspace is opened at.
export function workspacePath(workspace: Pick<Workspace, 'slug'>) {
  return `/workspaces/${workspace.slug}`
}
