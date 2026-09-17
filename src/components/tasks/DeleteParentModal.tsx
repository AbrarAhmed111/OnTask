'use client'

import { AlertTriangle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

// Deleting a parent is never a silent cascade — the caller must pick one of
// the two explicit outcomes below, or cancel.
export function DeleteParentModal({
  taskName,
  childCount,
  onDeleteAll,
  onOrphan,
  onClose,
}: {
  taskName: string
  childCount: number
  onDeleteAll: () => void
  onOrphan: () => void
  onClose: () => void
}) {
  return (
    <Modal
      eyebrow="This task has subtasks"
      title={`Delete "${taskName}"?`}
      onClose={onClose}
    >
      <div className="flex items-start gap-3 rounded-xl border border-coral/20 bg-coral/5 p-3">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-coral" />
        <p className="text-xs leading-5 text-muted">
          This task has {childCount} {childCount === 1 ? 'subtask' : 'subtasks'}
          . Choose what happens to them before it&apos;s removed.
        </p>
      </div>
      <div className="mt-5 flex flex-col gap-2">
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={onOrphan}
        >
          Keep subtasks as standalone tasks
        </Button>
        <Button
          type="button"
          variant="danger"
          className="w-full"
          onClick={onDeleteAll}
        >
          Delete this task and all its subtasks
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={onClose}
        >
          Cancel
        </Button>
      </div>
    </Modal>
  )
}
