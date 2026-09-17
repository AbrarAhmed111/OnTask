'use client'

import { FormEvent, useState } from 'react'
import { AlertTriangle, Check, Loader2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

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

function detectTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export function CreateWorkspaceModal({
  onCreate,
  onClose,
}: {
  onCreate: (
    name: string,
    description: string,
    timezone: string,
  ) => Promise<{ success: boolean; error?: string }>
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [timezone, setTimezone] = useState(detectTimezone)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const detected = detectTimezone()
  const timezoneOptions = COMMON_TIMEZONES.includes(detected)
    ? COMMON_TIMEZONES
    : [detected, ...COMMON_TIMEZONES]

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError('')
    const result = await onCreate(name.trim(), description, timezone)
    setLoading(false)
    if (!result.success) {
      setError(result.error || 'Failed to create workspace.')
      return
    }
    onClose()
  }

  return (
    <Modal
      eyebrow="Shared Workspaces"
      title="Create a workspace"
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
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
            placeholder="e.g. Product Team"
            className="mt-2 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted/60 focus:border-sage focus:ring-4 focus:ring-sage/15"
          />
        </label>
        <label className="block text-xs font-semibold text-muted">
          Description
          <textarea
            value={description}
            onChange={event => setDescription(event.target.value)}
            placeholder="Optional"
            rows={2}
            className="mt-2 w-full resize-none rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted/60 focus:border-sage focus:ring-4 focus:ring-sage/15"
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
          <span className="mt-1.5 block text-[10px] font-normal text-muted">
            Anchors daily boundaries for this workspace (e.g. shared daily
            summaries) — not each member&apos;s own browser timezone.
          </span>
        </label>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Check size={15} />
          )}
          Create workspace
        </Button>
      </form>
    </Modal>
  )
}
