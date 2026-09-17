'use client'

import { FormEvent, useState } from 'react'
import { AlertTriangle, Loader2, X } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

// Rejection reason is always optional — never required — but visible to the
// inviter once given.
export function RejectInvitationModal({
  workspaceName,
  onReject,
  onClose,
}: {
  workspaceName: string
  onReject: (reason: string) => Promise<{ success: boolean; error?: string }>
  onClose: () => void
}) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    const result = await onReject(reason)
    setLoading(false)
    if (!result.success) {
      setError(result.error || 'Failed to reject invitation.')
      return
    }
    onClose()
  }

  return (
    <Modal
      eyebrow="Decline invitation"
      title={`Reject invitation to "${workspaceName}"?`}
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
          Reason (optional, shown to the workspace owner)
          <textarea
            value={reason}
            onChange={event => setReason(event.target.value)}
            placeholder="Optional"
            rows={2}
            className="mt-2 w-full resize-none rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted/60 focus:border-sage focus:ring-4 focus:ring-sage/15"
          />
        </label>
        <Button
          type="submit"
          variant="danger"
          className="w-full"
          disabled={loading}
        >
          {loading ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <X size={15} />
          )}
          Reject invitation
        </Button>
      </form>
    </Modal>
  )
}
