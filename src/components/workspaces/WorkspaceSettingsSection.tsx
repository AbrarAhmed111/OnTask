import { ReactNode } from 'react'
import { Bell, Settings2, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { PreferenceToggle } from '@/components/ui/PreferenceToggle'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatTimeOfDay } from '@/lib/dailyReportWindow'
import { getWorkspaceTheme } from '@/lib/workspaceThemes'
import { PERSONAL_WORKSPACE_NAME } from '@/lib/workspaces'
import { Workspace } from '@/types/workspace'

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
        {label}
      </p>
      <p className="max-w-[60%] truncate text-xs font-bold text-ink">{value}</p>
    </div>
  )
}

function SettingsCard({
  icon: Icon,
  title,
  action,
  children,
}: {
  icon: typeof Settings2
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-line bg-panel shadow-sm">
      <div className="flex min-h-[57px] items-center justify-between border-b border-line/70 px-5 py-3">
        <h2 className="flex items-center gap-2 text-sm font-bold tracking-tight text-ink">
          <Icon size={15} /> {title}
        </h2>
        {action}
      </div>
      {children}
    </div>
  )
}

// The one Settings page for every workspace, personal or shared. Two things
// live here, and where each is saved is different:
//
//  - Workspace details (name, timezone, Daily Report time, accent): a property
//    of the workspace, stored on its row and shared by everyone in it. Only
//    the owner can edit them (`canManage`); everyone else sees them read-only.
//  - Your preferences (completion sound): a property of the person on this
//    device, kept in localStorage. Available to every member.
//
// A personal workspace keeps its fixed name and has no description.
export function WorkspaceSettingsSection({
  ready,
  error,
  workspace,
  isPersonal = false,
  canManage,
  preferences,
  onEdit,
}: {
  ready: boolean
  error?: string | null
  workspace: Workspace | null
  isPersonal?: boolean
  // Whether to offer editing the workspace itself (owner only).
  canManage: boolean
  preferences: {
    ready: boolean
    soundEnabled: boolean
    onSoundEnabledChange: (enabled: boolean) => void
  }
  onEdit: () => void
}) {
  const theme = getWorkspaceTheme(workspace?.accent)

  return (
    <div className="max-w-xl space-y-6">
      <SettingsCard
        icon={Settings2}
        title={isPersonal ? 'Personal Workspace settings' : 'Workspace details'}
        action={
          canManage && (
            <Button variant="secondary" onClick={onEdit} disabled={!ready}>
              Edit
            </Button>
          )
        }
      >
        {error && <ErrorBanner variant="flush">{error}</ErrorBanner>}
        {!ready || !workspace ? (
          <div className="space-y-4 px-5 py-4">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3.5 w-1/3" />
          </div>
        ) : (
          <div className="divide-y divide-line/70">
            <DetailRow
              label="Name"
              value={isPersonal ? PERSONAL_WORKSPACE_NAME : workspace.name}
            />
            {!isPersonal && (
              <DetailRow
                label="Description"
                value={workspace.description || 'No description yet.'}
              />
            )}
            <DetailRow label="Timezone" value={workspace.timezone} />
            <DetailRow
              label="Daily Report time"
              value={formatTimeOfDay(workspace.reportTime ?? '12:00:00')}
            />
            <DetailRow
              label="Accent theme"
              value={
                <span className="inline-flex items-center gap-2">
                  <span
                    aria-hidden
                    style={{ backgroundColor: theme.strong }}
                    className="h-3 w-3 rounded-full"
                  />
                  {theme.label}
                </span>
              }
            />
          </div>
        )}
      </SettingsCard>

      <SettingsCard icon={SlidersHorizontal} title="Your preferences">
        <div className="space-y-3 px-5 py-4">
          <PreferenceToggle
            icon={Bell}
            title="Completion sound"
            description="Play a short sound when a task reaches its target."
            checked={preferences.soundEnabled}
            disabled={!preferences.ready}
            onChange={preferences.onSoundEnabledChange}
          />
          <p className="text-[10px] text-muted">
            Preferences are saved on this device.
          </p>
        </div>
      </SettingsCard>
    </div>
  )
}
