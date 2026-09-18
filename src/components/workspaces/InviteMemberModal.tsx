'use client'

import { FormEvent, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { showErrorToast, showSuccessToast } from '@/lib/toast'

export function InviteMemberModal({
  onInvite,
  onClose,
}: {
  onInvite: (
    email: string,
    message: string,
  ) => Promise<{ success: boolean; error?: string; emailSent?: boolean }>
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
    if (result.emailSent) {
      showSuccessToast(`Invitation email sent to ${email.trim()}.`)
    } else {
      showErrorToast(
        "Invitation created, but the email couldn't be sent — they'll still see it in-app.",
      )
    }
    onClose()
  }

  return (
    <Modal eyebrow="Grow the team" title="Invite a member" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorBanner>{error}</ErrorBanner>}
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
          They&apos;ll get an email invitation, and also see it in-app next time
          they sign in to OnTask.
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
