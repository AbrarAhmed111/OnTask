import { AlertTriangle, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatTimeOfDay } from '@/lib/dailyReportWindow'
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
  error,
  workspace,
  isPersonal = false,
  onEdit,
}: {
  ready: boolean
  error?: string | null
  workspace: Workspace | null
  isPersonal?: boolean
  onEdit: () => void
}) {
  return (
    <div className="max-w-xl">
      <div className="rounded-2xl border border-line bg-panel shadow-sm">
        <div className="flex items-center justify-between border-b border-line/70 px-5 py-4">
          <h2 className="flex items-center gap-2 text-sm font-bold tracking-tight text-ink">
            <Settings2 size={15} />{' '}
            {isPersonal ? 'Personal Workspace settings' : 'Workspace details'}
          </h2>
          <Button variant="secondary" onClick={onEdit} disabled={!ready}>
            Edit
          </Button>
        </div>
        {error && (
          <div className="flex items-start gap-2 border-b border-line/70 px-5 py-3 text-xs leading-5 text-coral">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {!ready || !workspace ? (
          <div className="space-y-4 px-5 py-4">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3.5 w-1/3" />
          </div>
        ) : (
          <div className="divide-y divide-line/70">
            {!isPersonal && (
              <>
                <DetailRow label="Name" value={workspace.name} />
                <DetailRow
                  label="Description"
                  value={workspace.description || 'No description yet.'}
                />
              </>
            )}
            <DetailRow label="Timezone" value={workspace.timezone} />
            <DetailRow
              label="Daily Report time"
              value={formatTimeOfDay(workspace.reportTime ?? '12:00:00')}
            />
          </div>
        )}
      </div>
    </div>
  )
}
