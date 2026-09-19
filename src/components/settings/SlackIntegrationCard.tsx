'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Check,
  Hash,
  Loader2,
  MessageSquare,
  RefreshCw,
  LogOut,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Skeleton } from '@/components/ui/Skeleton'
import { SlackChannel } from '@/lib/integrations/slack/slackClient'

export interface SlackNotificationSettings {
  assigned: boolean
  completed: boolean
  blockers: boolean
  resolutions: boolean
  daily_reports: boolean
}

interface SlackStatusData {
  connected: boolean
  connection_status?:
    | 'connected'
    | 'disconnected'
    | 'invalid_token'
    | 'channel_missing'
    | 'configuration_incomplete'
    | string
  id?: string
  slack_team_id?: string
  slack_team_name?: string
  channel_id?: string
  channel_name?: string
  notification_settings?: SlackNotificationSettings
  can_manage?: boolean
}

export function SlackIntegrationCard({
  workspaceId,
  canManage,
}: {
  workspaceId: string
  canManage: boolean
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<SlackStatusData | null>(null)

  // Channel selection and toggles state
  const [channels, setChannels] = useState<SlackChannel[]>([])
  const [loadingChannels, setLoadingChannels] = useState(false)
  const [selectedChannelId, setSelectedChannelId] = useState<string>('')
  const [settings, setSettings] = useState<SlackNotificationSettings>({
    assigned: true,
    completed: true,
    blockers: true,
    resolutions: true,
    daily_reports: true,
  })
  const [saving, setSaving] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  const fetchStatus = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/integrations/slack/status?workspace_id=${workspaceId}`,
      )
      if (!res.ok) {
        throw new Error('Failed to load Slack integration status.')
      }
      const data: SlackStatusData = await res.json()
      setStatus(data)
      if (data.connected) {
        setSelectedChannelId(data.channel_id || '')
        if (data.notification_settings) {
          setSettings(data.notification_settings)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching status')
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  const fetchChannels = useCallback(async () => {
    if (!status?.connected) return
    setLoadingChannels(true)
    try {
      const res = await fetch(
        `/api/integrations/slack/channels?workspace_id=${workspaceId}`,
      )
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to fetch Slack channels.')
      }
      const data = await res.json()
      setChannels(data.channels || [])
    } catch (err) {
      console.error('[Slack UI] Failed to fetch channels:', err)
    } finally {
      setLoadingChannels(false)
    }
  }, [status?.connected, workspaceId])

  useEffect(() => {
    if (workspaceId) {
      void fetchStatus()
    }
  }, [workspaceId, fetchStatus])

  useEffect(() => {
    if (status?.connected) {
      void fetchChannels()
    }
  }, [status?.connected, fetchChannels])

  const handleConnect = () => {
    window.location.href = `/api/integrations/slack/oauth/authorize?workspace_id=${workspaceId}`
  }

  const handleSave = async () => {
    setSaving(true)
    setSavedSuccess(false)
    setError(null)
    try {
      const selectedChannel = channels.find(c => c.id === selectedChannelId)
      const res = await fetch('/api/integrations/slack/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          channelId: selectedChannelId,
          channelName: selectedChannel
            ? selectedChannel.name
            : status?.channel_name || '',
          notificationSettings: settings,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save settings.')
      }

      setSavedSuccess(true)
      setTimeout(() => setSavedSuccess(false), 3000)
      void fetchStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error saving settings')
    } finally {
      setSaving(false)
    }
  }

  const handleDisconnect = async () => {
    if (
      !confirm('Are you sure you want to disconnect Slack from this workspace?')
    )
      return
    setDisconnecting(true)
    setError(null)
    try {
      const res = await fetch('/api/integrations/slack/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to disconnect Slack.')
      }

      setStatus({ connected: false })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error disconnecting')
    } finally {
      setDisconnecting(false)
    }
  }

  const toggleSetting = (key: keyof SlackNotificationSettings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="rounded-2xl border border-line bg-panel shadow-sm">
      <div className="flex min-h-[57px] items-center justify-between border-b border-line/70 px-5 py-3">
        <h2 className="flex items-center gap-2 text-sm font-bold tracking-tight text-ink">
          <MessageSquare size={15} className="text-[#4A154B]" /> Slack
          Integration
        </h2>
        {status?.connected && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Connected
          </span>
        )}
      </div>

      {error && <ErrorBanner variant="flush">{error}</ErrorBanner>}

      {loading ? (
        <div className="space-y-4 px-5 py-5">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : !status?.connected ? (
        <div className="space-y-4 px-5 py-5">
          <p className="text-xs leading-5 text-muted">
            Connect your Slack workspace to receive automatic OnTask
            notifications for task assignments, completions, blockers, and Daily
            Reports.
          </p>
          {canManage ? (
            <Button
              onClick={handleConnect}
              className="bg-[#4A154B] hover:bg-[#3B113C] text-white gap-2 font-medium"
            >
              <MessageSquare size={14} /> Connect Slack
            </Button>
          ) : (
            <p className="text-[11px] italic text-muted">
              Only workspace owners and admins can connect Slack.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-5 px-5 py-5">
          {status.connection_status === 'invalid_token' && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between gap-3">
              <span>
                Authorization expired or revoked. Please reconnect Slack to
                continue receiving updates.
              </span>
              {canManage && (
                <Button
                  onClick={handleConnect}
                  className="shrink-0 text-xs py-1 px-2.5 bg-amber-600 hover:bg-amber-700 text-white"
                >
                  Reconnect
                </Button>
              )}
            </div>
          )}

          {status.connection_status === 'channel_missing' && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-200">
              Selected channel is no longer accessible. Please choose a valid
              Slack channel below.
            </div>
          )}

          {status.connection_status === 'configuration_incomplete' && (
            <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3.5 text-xs text-blue-800 dark:text-blue-200">
              Slack is connected! Select a destination channel below to activate
              notifications.
            </div>
          )}

          <div className="flex items-center justify-between rounded-xl border border-line bg-subtle/50 px-4 py-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                Connected Workspace
              </p>
              <p className="text-sm font-bold text-ink">
                {status.slack_team_name || 'Slack Workspace'}
              </p>
            </div>
            {canManage && (
              <Button
                variant="ghost"
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="text-red-500 hover:bg-red-500/10 hover:text-red-600 gap-1.5 text-xs py-1 px-2"
              >
                {disconnecting ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <LogOut size={13} />
                )}
                Disconnect
              </Button>
            )}
          </div>

          {/* Channel Picker */}
          <div className="space-y-2">
            <label className="flex items-center justify-between text-xs font-semibold text-ink">
              <span>Destination Channel</span>
              {loadingChannels && (
                <Loader2 size={12} className="animate-spin text-muted" />
              )}
            </label>
            <div className="relative">
              <select
                value={selectedChannelId}
                onChange={e => setSelectedChannelId(e.target.value)}
                disabled={!canManage || loadingChannels}
                className="w-full rounded-xl border border-line bg-panel px-3 py-2 text-xs font-medium text-ink focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">-- Select a Slack channel --</option>
                {channels.map(channel => (
                  <option key={channel.id} value={channel.id}>
                    #{channel.name} {channel.is_private ? '(private)' : ''}
                  </option>
                ))}
              </select>
            </div>
            {status.channel_name && !selectedChannelId && (
              <p className="text-[11px] text-muted">
                Currently posting to #{status.channel_name}
              </p>
            )}
          </div>

          {/* Notification Preferences Toggles */}
          <div className="space-y-2.5">
            <p className="text-xs font-semibold text-ink">Notification Types</p>
            <div className="grid gap-2">
              {[
                { key: 'assigned', label: 'Task assignments & reassignments' },
                { key: 'completed', label: 'Task completions & reopens' },
                { key: 'blockers', label: 'Task blockers created' },
                { key: 'resolutions', label: 'Blocker resolutions & unblocks' },
                { key: 'daily_reports', label: 'Daily Reports' },
              ].map(({ key, label }) => (
                <label
                  key={key}
                  className="flex items-center gap-2.5 rounded-lg border border-line/50 px-3 py-2 text-xs text-ink hover:bg-subtle/40 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={settings[key as keyof SlackNotificationSettings]}
                    onChange={() =>
                      toggleSetting(key as keyof SlackNotificationSettings)
                    }
                    disabled={!canManage}
                    className="h-4 w-4 rounded border-line text-accent focus:ring-ring"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Save Action */}
          {canManage && (
            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={saving || !selectedChannelId}
                className="gap-2 text-xs"
              >
                {saving ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : savedSuccess ? (
                  <Check size={13} />
                ) : (
                  <RefreshCw size={13} />
                )}
                {savedSuccess ? 'Saved!' : 'Save Settings'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
