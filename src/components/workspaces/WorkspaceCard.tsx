import Link from 'next/link'
import { ArrowRight, Users } from 'lucide-react'
import { Workspace } from '@/types/workspace'

export function WorkspaceCard({
  workspace,
  memberCount,
}: {
  workspace: Workspace
  memberCount: number
}) {
  return (
    <Link
      href={`/workspaces/${workspace.id}`}
      className="group flex flex-col justify-between rounded-2xl border border-line bg-panel p-5 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md sm:p-6"
    >
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
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-forest transition group-hover:text-coral">
          Open workspace <ArrowRight size={13} />
        </span>
      </div>
    </Link>
  )
}
