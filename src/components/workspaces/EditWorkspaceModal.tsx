'use client'

import { CSSProperties, FormEvent, useState } from 'react'
import { AlertTriangle, Check, Loader2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { showSuccessToast } from '@/lib/toast'
import {
  getWorkspaceTheme,
  WORKSPACE_THEMES,
  WorkspaceThemeId,
} from '@/lib/workspaceThemes'
import { Workspace } from '@/types/workspace'

const COMMON_TIMEZONES = [
  'UTC',
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Moscow',
  'Africa/Cairo',
  'Asia/Dubai',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Dhaka',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Auckland',
]

export function EditWorkspaceModal({
  workspace,
  onSave,
  onClose,
}: {
  workspace: Workspace
  onSave: (patch: {
    name: string
    description: string
    timezone: string
    accent: string
  }) => Promise<{ success: boolean; error?: string }>
  onClose: () => void
}) {
  const [name, setName] = useState(workspace.name)
  const [description, setDescription] = useState(workspace.description ?? '')
  const [timezone, setTimezone] = useState(workspace.timezone)
  const [accent, setAccent] = useState<WorkspaceThemeId>(
    (workspace.accent as WorkspaceThemeId) || 'forest',
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const timezoneOptions = COMMON_TIMEZONES.includes(workspace.timezone)
    ? COMMON_TIMEZONES
    : [workspace.timezone, ...COMMON_TIMEZONES]
  // Overrides the --ws-accent set by the surrounding WorkspaceShell (which
  // reflects the workspace's already-SAVED theme) with whatever the user
  // has clicked so far, so "Save changes" — and anything else themed inside
  // this form — previews the new color immediately instead of only
  // updating after the save round-trips.
  const previewTheme = getWorkspaceTheme(accent)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError('')
    const result = await onSave({
      name: name.trim(),
      description: description.trim(),
      timezone,
      accent,
    })
    setLoading(false)
    if (!result.success) {
      setError(result.error || 'Failed to save changes.')
      return
    }
    showSuccessToast('Workspace updated.')
    onClose()
  }

  return (
    <Modal eyebrow="Owner settings" title="Edit workspace" onClose={onClose}>
      <form
        onSubmit={handleSubmit}
        style={
          {
            '--ws-accent': previewTheme.strong,
            '--ws-accent-soft': previewTheme.soft,
          } as CSSProperties
        }
        className="space-y-4"
      >
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-coral/20 bg-coral/5 p-3 text-xs leading-5 text-coral">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <label className="block text-xs font-semibold text-muted">
          Workspace name
          <input
            required
            autoFocus
            value={name}
            onChange={event => setName(event.target.value)}
            className="mt-2 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-sage focus:ring-4 focus:ring-sage/15"
          />
        </label>
        <label className="block text-xs font-semibold text-muted">
          Description
          <textarea
            value={description}
            onChange={event => setDescription(event.target.value)}
            rows={2}
            className="mt-2 w-full resize-none rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-sage focus:ring-4 focus:ring-sage/15"
          />
        </label>
        <label className="block text-xs font-semibold text-muted">
          Timezone
          <select
            value={timezone}
            onChange={event => setTimezone(event.target.value)}
            className="mt-2 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-sage focus:ring-4 focus:ring-sage/15"
          >
            {timezoneOptions.map(zone => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
        </label>
        <div>
          <p className="text-xs font-semibold text-muted">Accent theme</p>
          <div className="mt-2 flex flex-wrap gap-2.5">
            {WORKSPACE_THEMES.map(theme => (
              <button
                key={theme.id}
                type="button"
                aria-label={theme.label}
                title={theme.label}
                onClick={() => setAccent(theme.id)}
                style={{ backgroundColor: theme.strong }}
                className={`grid h-8 w-8 place-items-center rounded-full transition ${
                  accent === theme.id
                    ? 'ring-2 ring-ink ring-offset-2 ring-offset-panel'
                    : 'hover:scale-105'
                }`}
              >
                {accent === theme.id && (
                  <Check size={14} className="text-white" />
                )}
              </button>
            ))}
          </div>
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Check size={15} />
          )}
          Save changes
        </Button>
      </form>
    </Modal>
  )
}
