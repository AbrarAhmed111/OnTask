import { CSSProperties } from 'react'
import Link from 'next/link'
import { ArrowRight, Users } from 'lucide-react'
import { getWorkspaceTheme } from '@/lib/workspaceThemes'
import { Workspace } from '@/types/workspace'

export function WorkspaceCard({
  workspace,
  memberCount,
}: {
  workspace: Workspace
  memberCount: number
}) {
  const theme = getWorkspaceTheme(workspace.accent)

  return (
    <Link
      href={`/workspaces/${workspace.id}`}
      style={{ '--card-accent': theme.strong } as CSSProperties}
      className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-line bg-panel shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md"
    >
      <div
        style={{ backgroundColor: theme.strong }}
        className="h-1.5 w-full shrink-0"
      />
      <div className="flex flex-1 flex-col justify-between p-5 sm:p-6">
        <div>
          <h3 className="text-sm font-bold tracking-tight text-ink">
            {workspace.name}
          </h3>
          <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-muted">
            {workspace.description || 'No description yet.'}
          </p>
        </div>
        <div className="mt-6 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
            <Users size={13} />
            {memberCount} {memberCount === 1 ? 'member' : 'members'}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--card-accent)] transition group-hover:text-coral">
            Open workspace <ArrowRight size={13} />
          </span>
        </div>
      </div>
    </Link>
  )
}
