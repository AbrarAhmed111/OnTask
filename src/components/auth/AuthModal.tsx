'use client'

import { FormEvent, useState } from 'react'
import { AlertTriangle, ArrowLeft, Check, Loader2 } from 'lucide-react'
import { FcGoogle } from 'react-icons/fc'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/client'

export type AuthStep = 'login' | 'signup' | 'forgot' | 'reset'

const STEP_COPY: Record<AuthStep, { eyebrow: string; title: string }> = {
  login: { eyebrow: 'Welcome back', title: 'Sign in to OnTask' },
  signup: { eyebrow: 'Create your account', title: 'Join OnTask' },
  forgot: { eyebrow: 'Reset password', title: 'Forgot your password?' },
  reset: { eyebrow: 'Almost done', title: 'Choose a new password' },
}

const inputClass =
  'mt-2 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted/60 focus:border-sage focus:ring-4 focus:ring-sage/15'

export function AuthModal({
  initialStep = 'login',
  inviteId,
  inviteWorkspaceName,
  prefillEmail,
  onClose,
  onAuthenticated,
}: {
  initialStep?: AuthStep
  // Set when this modal was opened from a workspace invitation link — swaps
  // the generic login/signup copy for something that tells the visitor why
  // they're being asked to sign in at all, and (for signup, see
  // handleSignup) survives the email-confirmation round trip so a brand-new
  // account still lands back on the invitation afterward.
  inviteId?: string
  inviteWorkspaceName?: string
  // Known-correct address for this flow (e.g. the address a workspace
  // invitation was sent to) — saves retyping it and steers a visitor away
  // from accidentally authenticating with the wrong account.
  prefillEmail?: string
  onClose: () => void
  onAuthenticated: () => void
}) {
  const [step, setStep] = useState<AuthStep>(initialStep)
  const [email, setEmail] = useState(prefillEmail ?? '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<{
    title: string
    message: string
  } | null>(null)

  const switchStep = (next: AuthStep) => {
    setError('')
    setSuccess(null)
    setStep(next)
  }

  const handleGoogle = async () => {
    setError('')
    setLoading(true)
    const supabase = createClient()
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    })
    if (oauthError) {
      setError(oauthError.message)
      setLoading(false)
    }
    // On success the browser navigates to Google, so no further state
    // update happens here — the component unmounts.
  }

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    setLoading(false)
    if (signInError) {
      setError(signInError.message)
      return
    }
    onAuthenticated()
  }

  const handleSignup = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setLoading(true)
    const supabase = createClient()
    const emailRedirectTo = inviteId
      ? `${window.location.origin}/?${new URLSearchParams({ invite: inviteId, workspace: inviteWorkspaceName || '' }).toString()}`
      : undefined
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName.trim() || undefined },
        emailRedirectTo,
      },
    })
    setLoading(false)
    if (signUpError) {
      setError(signUpError.message)
      return
    }
    if (data.session) {
      onAuthenticated()
      return
    }
    setSuccess({
      title: 'Check your inbox',
      message: `We sent a confirmation link to ${email}. Confirm your email to finish creating your account.`,
    })
  }

  const handleForgot = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      { redirectTo: `${window.location.origin}/` },
    )
    setLoading(false)
    if (resetError) {
      setError(resetError.message)
      return
    }
    setSuccess({
      title: 'Reset link sent',
      message: `Check ${email} for a link to reset your password.`,
    })
  }

  const handleReset = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setLoading(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    })
    setLoading(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    onAuthenticated()
  }

  const copy =
    inviteWorkspaceName && (step === 'login' || step === 'signup')
      ? {
          eyebrow: "You've been invited",
          title:
            step === 'login'
              ? `Log in to join ${inviteWorkspaceName}`
              : `Create an account to join ${inviteWorkspaceName}`,
        }
      : STEP_COPY[step]

  return (
    <Modal eyebrow={copy.eyebrow} title={copy.title} onClose={onClose}>
      {inviteWorkspaceName && (step === 'login' || step === 'signup') && (
        <p className="mb-4 text-xs leading-5 text-muted">
          Once you&apos;re signed in, you&apos;ll be connected to{' '}
          <strong className="font-semibold text-ink">
            {inviteWorkspaceName}
          </strong>
          .
        </p>
      )}
      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-coral/20 bg-coral/5 p-3 text-xs leading-5 text-coral">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success ? (
        <div>
          <div className="flex items-start gap-3 rounded-xl border border-sage/40 bg-sage/10 p-4">
            <Check size={18} className="mt-0.5 shrink-0 text-forest" />
            <div>
              <p className="text-sm font-semibold text-forest">
                {success.title}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted">
                {success.message}
              </p>
            </div>
          </div>
          <Button type="button" className="mt-5 w-full" onClick={onClose}>
            Done
          </Button>
        </div>
      ) : step === 'reset' ? (
        <form onSubmit={handleReset} className="space-y-4">
          <label className="block text-xs font-semibold text-muted">
            New password
            <input
              required
              autoFocus
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              className={inputClass}
            />
          </label>
          <label className="block text-xs font-semibold text-muted">
            Confirm new password
            <input
              required
              type="password"
              value={confirmPassword}
              onChange={event => setConfirmPassword(event.target.value)}
              className={inputClass}
            />
          </label>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Check size={15} />
            )}
            Update password
          </Button>
        </form>
      ) : (
        <div className="space-y-4">
          {step !== 'forgot' && (
            <>
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={handleGoogle}
                disabled={loading}
              >
                <FcGoogle size={16} /> Continue with Google
              </Button>
              <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                <span className="h-px flex-1 bg-line" />
                or
                <span className="h-px flex-1 bg-line" />
              </div>
            </>
          )}

          {step === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <label className="block text-xs font-semibold text-muted">
                Email
                <input
                  required
                  autoFocus
                  type="email"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className={inputClass}
                />
              </label>
              <label className="block text-xs font-semibold text-muted">
                Password
                <input
                  required
                  type="password"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  className={inputClass}
                />
              </label>
              <button
                type="button"
                onClick={() => switchStep('forgot')}
                className="text-[11px] font-semibold text-forest transition hover:text-coral"
              >
                Forgot password?
              </button>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 size={15} className="animate-spin" />}
                Sign in
              </Button>
              <p className="text-center text-[11px] text-muted">
                New to OnTask?{' '}
                <button
                  type="button"
                  onClick={() => switchStep('signup')}
                  className="font-semibold text-forest transition hover:text-coral"
                >
                  Create an account
                </button>
              </p>
            </form>
          )}

          {step === 'signup' && (
            <form onSubmit={handleSignup} className="space-y-4">
              <label className="block text-xs font-semibold text-muted">
                Name
                <input
                  autoFocus
                  value={fullName}
                  onChange={event => setFullName(event.target.value)}
                  placeholder="Optional"
                  className={inputClass}
                />
              </label>
              <label className="block text-xs font-semibold text-muted">
                Email
                <input
                  required
                  type="email"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className={inputClass}
                />
              </label>
              <label className="block text-xs font-semibold text-muted">
                Password
                <input
                  required
                  type="password"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  className={inputClass}
                />
              </label>
              <label className="block text-xs font-semibold text-muted">
                Confirm password
                <input
                  required
                  type="password"
                  value={confirmPassword}
                  onChange={event => setConfirmPassword(event.target.value)}
                  className={inputClass}
                />
              </label>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 size={15} className="animate-spin" />}
                Create account
              </Button>
              <p className="text-center text-[11px] text-muted">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchStep('login')}
                  className="font-semibold text-forest transition hover:text-coral"
                >
                  Sign in
                </button>
              </p>
            </form>
          )}

          {step === 'forgot' && (
            <form onSubmit={handleForgot} className="space-y-4">
              <p className="text-xs leading-5 text-muted">
                Enter your account email and we&apos;ll send you a link to reset
                your password.
              </p>
              <label className="block text-xs font-semibold text-muted">
                Email
                <input
                  required
                  autoFocus
                  type="email"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className={inputClass}
                />
              </label>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 size={15} className="animate-spin" />}
                Send reset link
              </Button>
              <button
                type="button"
                onClick={() => switchStep('login')}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-forest transition hover:text-coral"
              >
                <ArrowLeft size={13} /> Back to sign in
              </button>
            </form>
          )}
        </div>
      )}
    </Modal>
  )
}
