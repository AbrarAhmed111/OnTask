'use client'

import { FormEvent, useState } from 'react'
import { AlertTriangle, Check, Loader2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

export function InviteMemberModal({
  onInvite,
  onClose,
}: {
  onInvite: (
    email: string,
    message: string,
  ) => Promise<{ success: boolean; error?: string }>
  onClose: () => void
}) {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError('')
    const result = await onInvite(email, message)
    setLoading(false)
    if (!result.success) {
      setError(result.error || 'Failed to send invitation.')
      return
    }
    onClose()
  }

  return (
    <Modal eyebrow="Grow the team" title="Invite a member" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-coral/20 bg-coral/5 p-3 text-xs leading-5 text-coral">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <label className="block text-xs font-semibold text-muted">
          Email address
          <input
            required
            autoFocus
            type="email"
            value={email}
            onChange={event => setEmail(event.target.value)}
            placeholder="teammate@example.com"
            className="mt-2 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted/60 focus:border-sage focus:ring-4 focus:ring-sage/15"
          />
        </label>
        <label className="block text-xs font-semibold text-muted">
          Message
          <textarea
            value={message}
            onChange={event => setMessage(event.target.value)}
            placeholder="Optional"
            rows={2}
            className="mt-2 w-full resize-none rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted/60 focus:border-sage focus:ring-4 focus:ring-sage/15"
          />
        </label>
        <p className="text-[10px] leading-4 text-muted">
          They&apos;ll see this invitation next time they sign in to OnTask — no
          email is sent.
        </p>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Check size={15} />
          )}
          Send invitation
        </Button>
      </form>
    </Modal>
  )
}
