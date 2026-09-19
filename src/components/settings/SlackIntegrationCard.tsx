'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Check,
  Copy,
  ExternalLink,
  Hash,
  Loader2,
  LogOut,
  RefreshCw,
  Share2,
  Sparkles,
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

function SlackLogo({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 122.8 122.8"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M25.8 77.6c0 7.1-5.8 12.9-12.9 12.9S0 84.7 0 77.6s5.8-12.9 12.9-12.9h12.9v12.9zm6.5 0c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V77.6z"
        fill="#E01E5A"
      />
      <path
        d="M45.2 25.8c-7.1 0-12.9-5.8-12.9-12.9S38.1 0 45.2 0s12.9 5.8 12.9 12.9v12.9H45.2zm0 6.5c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H12.9C5.8 58.1 0 52.3 0 45.2s5.8-12.9 12.9-12.9h32.3z"
        fill="#36C5F0"
      />
      <path
        d="M97 45.2c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9-5.8 12.9-12.9 12.9H97V45.2zm-6.5 0c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V12.9C64.7 5.8 70.5 0 77.6 0s12.9 5.8 12.9 12.9v32.3z"
        fill="#2EB67D"
      />
      <path
        d="M77.6 97c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9-12.9-5.8-12.9-12.9V97h12.9zm0-6.5c-7.1 0-12.9-5.8-12.9-12.9s5.8-12.9 12.9-12.9h32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H77.6z"
        fill="#ECB22E"
      />
    </svg>
  )
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

  // Copy states for share section
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [copiedEmbed, setCopiedEmbed] = useState(false)
  const [copiedMeta, setCopiedMeta] = useState(false)

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

  const getAuthorizeUrl = () => {
    const origin =
      typeof window !== 'undefined'
        ? window.location.origin
        : 'http://localhost:3000'
    return `${origin}/api/integrations/slack/oauth/authorize?workspace_id=${workspaceId}`
  }

  const getEmbedCode = () => {
    const authUrl = getAuthorizeUrl()
    return `<a href="${authUrl}"><img alt="Add to Slack" height="40" width="139" src="https://platform.slack-edge.com/img/add_to_slack.png" srcSet="https://platform.slack-edge.com/img/add_to_slack.png 1x, https://platform.slack-edge.com/img/add_to_slack@2x.png 2x" /></a>`
  }

  const getMetaTagCode = () => {
    return `<meta name="slack-app-id" content="${process.env.NEXT_PUBLIC_SLACK_CLIENT_ID || 'A00000000'}">`
  }

  const handleConnect = () => {
    window.location.href = getAuthorizeUrl()
  }

  const handleCopyShareUrl = () => {
    void navigator.clipboard.writeText(getAuthorizeUrl())
    setCopiedUrl(true)
    setTimeout(() => setCopiedUrl(false), 2500)
  }

  const handleCopyEmbedCode = () => {
    void navigator.clipboard.writeText(getEmbedCode())
    setCopiedEmbed(true)
    setTimeout(() => setCopiedEmbed(false), 2500)
  }

  const handleCopyMetaTag = () => {
    void navigator.clipboard.writeText(getMetaTagCode())
    setCopiedMeta(true)
    setTimeout(() => setCopiedMeta(false), 2500)
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
    <div className="rounded-2xl border border-line bg-panel shadow-sm divide-y divide-line/70">
      {/* Card Header */}
      <div className="flex min-h-[57px] items-center justify-between px-5 py-3.5">
        <h2 className="flex items-center gap-2.5 text-sm font-bold tracking-tight text-ink">
          <SlackLogo className="h-5 w-5" /> Slack Integration
        </h2>
        {status?.connected ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Connected
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-subtle px-2.5 py-0.5 text-[11px] font-medium text-muted">
            Not Connected
          </span>
        )}
      </div>

      {error && <ErrorBanner variant="flush">{error}</ErrorBanner>}

      {loading ? (
        <div className="space-y-4 px-5 py-6">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        <div className="space-y-6 px-5 py-6">
          {/* Main Connection Status / Controls */}
          {!status?.connected ? (
            <div className="space-y-4">
              <p className="text-xs leading-5 text-muted">
                Connect your Slack workspace to receive automatic OnTask
                notifications for task assignments, completions, blockers, and
                Daily Reports directly inside your Slack channel.
              </p>

              {canManage ? (
                <div className="pt-1">
                  {/* Official "Add to Slack" Button */}
                  <button
                    type="button"
                    onClick={handleConnect}
                    className="inline-flex items-center gap-3 rounded-xl bg-[#4A154B] px-5 py-3 font-bold text-xs text-white shadow-md transition-all hover:bg-[#39103A] hover:shadow-lg active:scale-[0.99]"
                  >
                    <SlackLogo className="h-5 w-5" />
                    <span>Add to Slack</span>
                  </button>
                </div>
              ) : (
                <p className="text-[11px] italic text-muted">
                  Only workspace owners and admins can connect Slack.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-5">
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
                  Selected channel is no longer accessible. Please choose a
                  valid Slack channel below.
                </div>
              )}

              {status.connection_status === 'configuration_incomplete' && (
                <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3.5 text-xs text-blue-800 dark:text-blue-200">
                  Slack is connected! Select a destination channel below to
                  activate notifications.
                </div>
              )}

              <div className="flex items-center justify-between rounded-xl border border-line bg-subtle/50 px-4 py-3">
                <div className="flex items-center gap-3">
                  <SlackLogo className="h-6 w-6" />
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                      Connected Workspace
                    </p>
                    <p className="text-sm font-bold text-ink">
                      {status.slack_team_name || 'Slack Workspace'}
                    </p>
                  </div>
                </div>
                {canManage && (
                  <Button
                    variant="ghost"
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    className="text-red-500 hover:bg-red-500/10 hover:text-red-600 gap-1.5 text-xs py-1 px-2.5"
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
                <p className="text-xs font-semibold text-ink">
                  Notification Types
                </p>
                <div className="grid gap-2">
                  {[
                    {
                      key: 'assigned',
                      label: 'Task assignments & reassignments',
                    },
                    { key: 'completed', label: 'Task completions & reopens' },
                    { key: 'blockers', label: 'Task blockers created' },
                    {
                      key: 'resolutions',
                      label: 'Blocker resolutions & unblocks',
                    },
                    { key: 'daily_reports', label: 'Daily Reports' },
                  ].map(({ key, label }) => (
                    <label
                      key={key}
                      className="flex items-center gap-2.5 rounded-lg border border-line/50 px-3 py-2 text-xs text-ink hover:bg-subtle/40 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={
                          settings[key as keyof SlackNotificationSettings]
                        }
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

          {/* Share Your App with Any Workspace Section */}
          {canManage && (
            <div className="rounded-2xl border border-line bg-subtle/30 p-5 space-y-5">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-xs font-bold tracking-tight text-ink">
                    <Share2 size={14} className="text-accent" /> Share Your App
                    with Any Workspace
                  </h3>
                </div>
                <p className="text-xs leading-5 text-muted mt-1">
                  Use the URL and Add to Slack button below to share your app
                  with any Slack workspace.{' '}
                  <a
                    href="https://docs.slack.dev/legacy/legacy-slack-button/"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-0.5 text-accent hover:underline font-medium"
                  >
                    Learn more about sharing your app using these tools{' '}
                    <ExternalLink size={11} />
                  </a>
                </p>
              </div>

              {/* Embeddable Slack Button Sub-section */}
              <div className="space-y-2 rounded-xl border border-line bg-panel p-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-ink">
                    Embeddable Slack Button
                  </h4>
                  <Button
                    variant="ghost"
                    onClick={handleCopyEmbedCode}
                    className="gap-1 text-[11px] py-1 px-2.5 text-accent hover:bg-accent/10"
                  >
                    {copiedEmbed ? <Check size={11} /> : <Copy size={11} />}
                    {copiedEmbed ? 'Copied HTML' : 'Copy HTML'}
                  </Button>
                </div>
                <div className="flex items-center gap-3 py-1">
                  {/* Visual preview of button */}
                  <a href={getAuthorizeUrl()} className="inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      alt="Add to Slack"
                      height="40"
                      width="139"
                      src="https://platform.slack-edge.com/img/add_to_slack.png"
                      srcSet="https://platform.slack-edge.com/img/add_to_slack.png 1x, https://platform.slack-edge.com/img/add_to_slack@2x.png 2x"
                    />
                  </a>
                  <span className="text-[11px] text-muted italic">
                    Interactive preview
                  </span>
                </div>
                <div className="relative">
                  <pre className="overflow-x-auto rounded-lg border border-line bg-subtle p-3 text-[11px] font-mono text-muted select-all">
                    {getEmbedCode()}
                  </pre>
                </div>
              </div>

              {/* Sharable URL Sub-section */}
              <div className="space-y-2 rounded-xl border border-line bg-panel p-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-ink">Sharable URL</h4>
                  <Button
                    variant="ghost"
                    onClick={handleCopyShareUrl}
                    className="gap-1 text-[11px] py-1 px-2.5 text-accent hover:bg-accent/10"
                  >
                    {copiedUrl ? <Check size={11} /> : <Copy size={11} />}
                    {copiedUrl ? 'Copied URL' : 'Copy URL'}
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={getAuthorizeUrl()}
                    className="w-full rounded-lg border border-line bg-subtle px-3 py-2 text-xs font-mono text-muted select-all focus:outline-none"
                  />
                </div>
              </div>

              {/* App Suggestions HTML Sub-section */}
              <div className="space-y-2 rounded-xl border border-line bg-panel p-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-ink">
                    App Suggestions HTML
                  </h4>
                  <Button
                    variant="ghost"
                    onClick={handleCopyMetaTag}
                    className="gap-1 text-[11px] py-1 px-2.5 text-accent hover:bg-accent/10"
                  >
                    {copiedMeta ? <Check size={11} /> : <Copy size={11} />}
                    {copiedMeta ? 'Copied Meta Tag' : 'Copy Meta Tag'}
                  </Button>
                </div>
                <p className="text-[11px] leading-4 text-muted">
                  Add this tag to suggest your app to new users when links from
                  your domain are mentioned in Slack.{' '}
                  <a
                    href="https://docs.slack.dev/slack-marketplace/distributing-your-app-in-the-slack-marketplace/#suggestions"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-0.5 text-accent hover:underline font-medium"
                  >
                    Learn more <ExternalLink size={10} />
                  </a>
                </p>
                <div className="relative">
                  <pre className="overflow-x-auto rounded-lg border border-line bg-subtle p-3 text-[11px] font-mono text-muted select-all">
                    {getMetaTagCode()}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
