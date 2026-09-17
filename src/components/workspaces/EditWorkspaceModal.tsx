'use client'

import { FormEvent, useState } from 'react'
import { AlertTriangle, Check, Loader2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
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
  }) => Promise<{ success: boolean; error?: string }>
  onClose: () => void
}) {
  const [name, setName] = useState(workspace.name)
  const [description, setDescription] = useState(workspace.description ?? '')
  const [timezone, setTimezone] = useState(workspace.timezone)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const timezoneOptions = COMMON_TIMEZONES.includes(workspace.timezone)
    ? COMMON_TIMEZONES
    : [workspace.timezone, ...COMMON_TIMEZONES]

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError('')
    const result = await onSave({
      name: name.trim(),
      description: description.trim(),
      timezone,
    })
    setLoading(false)
    if (!result.success) {
      setError(result.error || 'Failed to save changes.')
      return
    }
    onClose()
  }

  return (
    <Modal eyebrow="Owner settings" title="Edit workspace" onClose={onClose}>
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
