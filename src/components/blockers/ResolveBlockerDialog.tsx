'use client'

import { FormEvent, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { BLOCKER_NOTE_MAX } from '@/lib/tasks/blockers'

// A small confirmation for resolving a blocker: what it was, an optional note
// on what changed, and the two buttons. Resolving puts the task back in the
// queue — it never starts anything, and the dialog says so, because whoever
// resolves it may not be the person who works on it.
export function ResolveBlockerDialog({
  taskName,
  reason,
  onSubmit,
  onClose,
}: {
  taskName: string
  reason: string
  onSubmit: (note: string) => void
  onClose: () => void
}) {
  const [note, setNote] = useState('')

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit(note.trim())
  }

  return (
    <Modal eyebrow="Blocker" title="Resolve blocker" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <p className="text-xs font-semibold text-ink">{taskName}</p>
        <blockquote className="mt-2 whitespace-pre-wrap break-words rounded-lg border border-coral/20 bg-coral/5 px-3 py-2 text-xs leading-5 text-ink">
          {reason}
        </blockquote>

        <label
          htmlFor="resolve-blocker-note"
          className="mt-4 block text-xs font-semibold text-muted"
        >
          What changed? <span className="font-normal">(optional)</span>
        </label>
        <textarea
          id="resolve-blocker-note"
          autoFocus
          value={note}
          onChange={event => setNote(event.target.value)}
          maxLength={BLOCKER_NOTE_MAX}
          rows={3}
          placeholder="API credentials have been provided."
          className="mt-2 w-full resize-none rounded-lg border border-line bg-white px-3 py-2.5 text-sm leading-6 text-ink outline-none transition placeholder:text-muted/60 focus:border-sage focus:ring-4 focus:ring-sage/15"
        />
        <p className="mt-2 text-[10px] leading-4 text-muted">
          The task goes back to the queue. Its timer doesn&apos;t start — the
          person it&apos;s assigned to starts it again when they&apos;re ready.
        </p>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Resolve blocker</Button>
        </div>
      </form>
    </Modal>
  )
}
