'use client'

import { FormEvent, useState } from 'react'
import { Bell, Check, PlayCircle, RotateCcw, TimerReset } from 'lucide-react'
import { Settings } from '@/types'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

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
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 transition hover:border-sage">
          <input
            type="checkbox"
            checked={soundEnabled}
            onChange={event => setSoundEnabled(event.target.checked)}
            className="mt-0.5 h-4 w-4 accent-forest"
          />
          <span>
            <span className="flex items-center gap-2 text-xs font-semibold text-ink">
              <Bell size={14} className="text-forest" /> Completion sound
            </span>
            <span className="mt-1 block text-[11px] leading-5 text-muted">
              Play a short sound when a task reaches its target.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 transition hover:border-sage">
          <input
            type="checkbox"
            checked={autoStartNextTask}
            onChange={event => setAutoStartNextTask(event.target.checked)}
            className="mt-0.5 h-4 w-4 accent-forest"
          />
          <span>
            <span className="flex items-center gap-2 text-xs font-semibold text-ink">
              <PlayCircle size={14} className="text-forest" /> Auto-start next
              task
            </span>
            <span className="mt-1 block text-[11px] leading-5 text-muted">
              Begin the next pending task automatically after completion.
            </span>
          </span>
        </label>
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
