import Link from 'next/link'
import { ArrowRight, Lock, UserRound } from 'lucide-react'
import { PERSONAL_WORKSPACE_PATH } from '@/lib/workspaces'

// The hub's fixed entry for the user's own private workspace. Deliberately
// not a WorkspaceCard: a personal workspace has no member count or
// description, exactly one exists per user, and it should read as "yours" —
// visually distinct from the shared workspaces listed beneath it.
export function PersonalWorkspaceCard() {
  return (
    <Link
      href={PERSONAL_WORKSPACE_PATH}
      className="group flex flex-col gap-5 rounded-2xl border border-forest bg-forest p-5 text-white shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md sm:flex-row sm:items-center sm:justify-between sm:p-6"
    >
      <div className="flex items-start gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/15">
          <UserRound size={22} />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-bold tracking-tight">
            Personal Workspace
          </h2>
          <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-white/80">
            <Lock size={12} className="shrink-0" /> Private &bull; Only you
          </p>
          <p className="mt-2 text-[11px] leading-5 text-white/65">
            Goals &middot; Tasks &middot; Time &middot; Progress &middot; AI
            Reports
          </p>
        </div>
      </div>
      <span className="inline-flex shrink-0 items-center justify-center gap-1.5 self-start rounded-lg bg-white px-3.5 py-2.5 text-xs font-semibold text-forest transition group-hover:bg-white/90 sm:self-auto">
        Open Workspace <ArrowRight size={14} />
      </span>
    </Link>
  )
}
