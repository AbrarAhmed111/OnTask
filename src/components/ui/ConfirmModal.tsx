'use client'

import { AlertTriangle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

export function ConfirmModal({
  title,
  message,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Modal eyebrow="Please confirm" title={title} onClose={onClose}>
      <div className="flex items-start gap-3 rounded-xl border border-coral/20 bg-coral/5 p-3">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-coral" />
        <p className="text-xs leading-5 text-muted">{message}</p>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" variant="danger" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
