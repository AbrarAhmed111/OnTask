import { ReactNode } from 'react'
import {
  Bell,
  CircleHelp,
  FileText,
  Settings2,
  Sparkles,
  SlidersHorizontal,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { PreferenceToggle } from '@/components/ui/PreferenceToggle'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatTimeOfDay } from '@/lib/dailyReportWindow'
import { getWorkspaceTheme } from '@/lib/workspaceThemes'
import { PERSONAL_WORKSPACE_NAME } from '@/lib/workspaces'
import { Workspace } from '@/types/workspace'
import { SlackIntegrationCard } from '@/components/settings/SlackIntegrationCard'

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
// Plus "Help & guidance", which replays this workspace's onboarding tour.
//
// The Daily Report switch is a property of the workspace too (owner only), but
// it is a plain on/off with an immediate effect, so it has its own card and
// saves on the spot rather than going through the Edit dialog.
//
// A personal workspace keeps its fixed name and has no description.
export function WorkspaceSettingsSection({
  ready,
  error,
  workspace,
  isPersonal = false,
  canManage,
  preferences,
  dailyReports,
  guidance,
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
  // Replaying this workspace's onboarding tour. `label` names it ("Personal
  // Workspace tour"); omit `guidance` to leave the card out.
  guidance?: { label: string; onReplay: () => void }
  // Turning the Daily Report on or off; omit to leave the card out.
  dailyReports?: { saving: boolean; onChange: (enabled: boolean) => void }
  onEdit: () => void
}) {
  const theme = getWorkspaceTheme(workspace?.accent)

  return (
    <div className="grid w-full max-w-[1200px] gap-6 md:grid-cols-2 xl:grid-cols-3">
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

      {dailyReports && workspace && (
        <SettingsCard icon={Sparkles} title="Daily Reports">
          <div className="space-y-3 px-5 py-4">
            <PreferenceToggle
              icon={FileText}
              title="AI Daily Report"
              description={`${
                isPersonal
                  ? 'A short written summary of your work,'
                  : 'A short written summary of what the workspace got done,'
              } generated each day at ${formatTimeOfDay(workspace.reportTime ?? '12:00:00')}.`}
              checked={workspace.dailyReportsEnabled}
              disabled={!ready || !canManage || dailyReports.saving}
              onChange={dailyReports.onChange}
            />
            <p className="text-[10px] leading-4 text-muted">
              {!canManage
                ? 'Only the workspace owner can change this.'
                : workspace.dailyReportsEnabled
                  ? 'Turning this off hides the Daily Report and stops new reports. Reports already written are kept.'
                  : 'Turn this on to start receiving a Daily Report. Reports already written are kept, and nothing is written for the time it was off.'}
            </p>
          </div>
        </SettingsCard>
      )}

      {!isPersonal && workspace && (
        <SlackIntegrationCard
          workspaceId={workspace.id}
          canManage={canManage}
        />
      )}

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

      {guidance && (
        <SettingsCard icon={CircleHelp} title="Help & guidance">
          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <p className="text-xs leading-5 text-muted">
              Take a quick look around this workspace again.
            </p>
            <Button
              variant="secondary"
              onClick={guidance.onReplay}
              disabled={!ready}
              className="shrink-0"
            >
              Replay {guidance.label}
            </Button>
          </div>
        </SettingsCard>
      )}
    </div>
  )
}
