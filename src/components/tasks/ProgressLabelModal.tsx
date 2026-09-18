'use client'

import { FormEvent } from 'react'
import { Check } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { ProgressBar } from '@/components/ui/ProgressBar'

export function ProgressLabelModal({
  progress,
  setProgress,
  onSave,
  onClose,
}: {
  progress: string
  setProgress: (value: string) => void
  onSave: (event: FormEvent) => void
  onClose: () => void
}) {
  return (
    <Modal
      eyebrow="Long-term progress"
      title="Update progress"
      onClose={onClose}
    >
      <form onSubmit={onSave}>
        <label className="block text-xs font-semibold text-muted">
          How complete is this now?
          <div className="mt-2 flex items-center gap-2">
            <input
              autoFocus
              type="number"
              min="0"
              max="100"
              value={progress}
              onChange={event => setProgress(event.target.value)}
              className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-sage focus:ring-4 focus:ring-sage/15"
            />
            <span className="font-mono text-forest">%</span>
          </div>
        </label>
        <ProgressBar value={Number(progress)} tone="sage" className="mt-5" />
        <Button type="submit" className="mt-5 w-full">
          <Check size={16} /> Save progress
        </Button>
      </form>
    </Modal>
  )
}
