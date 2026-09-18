'use client'

import { FormEvent, useState } from 'react'
import { Bell, Check, PlayCircle, RotateCcw, TimerReset } from 'lucide-react'
import { Settings } from '@/types'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { PreferenceToggle } from '@/components/ui/PreferenceToggle'

// The guest dashboard's preferences dialog. These are device-local
// preferences (see lib/storage.ts); the same completion-sound preference is
// also exposed on a workspace's Settings page once signed in.
export function SettingsModal({
  settings,
  onSave,
  onReset,
  onClose,
}: {
  settings: Settings
  onSave: (settings: Partial<Settings>) => void
  onReset: () => void
  onClose: () => void
}) {
  const [hours, setHours] = useState(
    String(Math.floor(settings.dailyTargetMinutes / 60)),
  )
  const [minutes, setMinutes] = useState(
    String(settings.dailyTargetMinutes % 60),
  )
  const [soundEnabled, setSoundEnabled] = useState(settings.soundEnabled)
  const [autoStartNextTask, setAutoStartNextTask] = useState(
    settings.autoStartNextTask,
  )

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const dailyTargetMinutes = Math.max(
      1,
      Number(hours || 0) * 60 + Math.min(59, Number(minutes || 0)),
    )
    onSave({ dailyTargetMinutes, soundEnabled, autoStartNextTask })
    onClose()
  }

  return (
    <Modal eyebrow="Preferences" title="Settings" onClose={onClose}>
      <form onSubmit={submit} className="space-y-5">
        <label className="block text-xs font-semibold text-muted">
          Daily focus target
          <div className="mt-2 flex items-center gap-2">
            <TimerReset size={16} className="text-forest" />
            <input
              type="number"
              min="0"
              value={hours}
              onChange={event => setHours(event.target.value)}
              className="w-20 rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-sage focus:ring-4 focus:ring-sage/15"
            />
            <span className="text-[11px] font-normal">hours</span>
            <input
              type="number"
              min="0"
              max="59"
              value={minutes}
              onChange={event => setMinutes(event.target.value)}
              className="w-20 rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-sage focus:ring-4 focus:ring-sage/15"
            />
            <span className="text-[11px] font-normal">minutes</span>
          </div>
        </label>
        <PreferenceToggle
          icon={Bell}
          title="Completion sound"
          description="Play a short sound when a task reaches its target."
          checked={soundEnabled}
          onChange={setSoundEnabled}
        />
        <PreferenceToggle
          icon={PlayCircle}
          title="Auto-start next task"
          description="Begin the next pending task automatically after completion."
          checked={autoStartNextTask}
          onChange={setAutoStartNextTask}
        />
        <div className="flex items-center justify-between border-t border-line pt-4">
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-2 text-[11px] font-semibold text-coral transition hover:text-coral/70"
          >
            <RotateCcw size={14} /> Reset local data
          </button>
          <Button type="submit">
            <Check size={15} /> Save settings
          </Button>
        </div>
      </form>
    </Modal>
  )
}
