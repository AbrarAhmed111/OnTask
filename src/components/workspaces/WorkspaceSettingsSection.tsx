import { Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { Workspace } from '@/types/workspace'

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
        {label}
      </p>
      <p className="max-w-[60%] truncate text-xs font-bold text-ink">{value}</p>
    </div>
  )
}

export function WorkspaceSettingsSection({
  ready,
  workspace,
  onEdit,
}: {
  ready: boolean
  workspace: Workspace | null
  onEdit: () => void
}) {
  return (
    <div className="max-w-xl">
      <div className="rounded-2xl border border-line bg-panel shadow-sm">
        <div className="flex items-center justify-between border-b border-line/70 px-5 py-4">
          <h2 className="flex items-center gap-2 text-sm font-bold tracking-tight text-ink">
            <Settings2 size={15} /> Workspace details
          </h2>
          <Button variant="secondary" onClick={onEdit} disabled={!ready}>
            Edit
          </Button>
        </div>
        {!ready || !workspace ? (
          <div className="space-y-4 px-5 py-4">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3.5 w-1/3" />
          </div>
        ) : (
          <div className="divide-y divide-line/70">
            <DetailRow label="Name" value={workspace.name} />
            <DetailRow
              label="Description"
              value={workspace.description || 'No description yet.'}
            />
            <DetailRow label="Timezone" value={workspace.timezone} />
          </div>
        )}
      </div>
    </div>
  )
}
