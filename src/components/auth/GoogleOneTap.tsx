'use client'

import Script from 'next/script'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

type GoogleCredentialResponse = { credential: string }

type GoogleIdConfiguration = {
  client_id: string
  callback: (response: GoogleCredentialResponse) => void
  nonce: string
  context?: 'signin' | 'signup' | 'use'
  use_fedcm_for_prompt?: boolean
  itp_support?: boolean
  cancel_on_tap_outside?: boolean
}

type PromptMomentNotification = {
  isNotDisplayed: () => boolean
  isSkippedMoment: () => boolean
  getNotDisplayedReason?: () => string
  getSkippedReason?: () => string
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: GoogleIdConfiguration) => void
          prompt: (
            listener?: (notification: PromptMomentNotification) => void,
          ) => void
          cancel: () => void
          disableAutoSelect: () => void
        }
      }
    }
  }
}

// Generates a nonce and its SHA-256 hash, per Supabase's recommended flow for
// verifying Google ID tokens: the hash goes to Google (`initialize`), the raw
// value goes to Supabase (`signInWithIdToken`) so it can confirm the token was
// issued for this exact sign-in attempt.
async function createNonce() {
  const random = crypto.getRandomValues(new Uint8Array(32))
  const nonce = btoa(String.fromCharCode(...random))
  const encoded = new TextEncoder().encode(nonce)
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded)
  const hashedNonce = Array.from(new Uint8Array(hashBuffer))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
  return { nonce, hashedNonce }
}

// Renders nothing itself — Google injects its own floating prompt UI. Mount
// only once the caller knows the visitor is a signed-out guest; `enabled`
// additionally lets the caller suppress the prompt for a moment (e.g. while
// the manual sign-in modal is already open) without unmounting the script.
export function GoogleOneTap({
  enabled,
  onSignedIn,
}: {
  enabled: boolean
  onSignedIn?: () => void
}) {
  const [scriptReady, setScriptReady] = useState(false)
  const promptedRef = useRef(false)

  useEffect(() => {
    if (!enabled || !scriptReady || !GOOGLE_CLIENT_ID || promptedRef.current)
      return
    if (typeof window === 'undefined' || !window.google) return

    promptedRef.current = true
    let cancelled = false

    void (async () => {
      const { nonce, hashedNonce } = await createNonce()
      if (cancelled || !window.google) return

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        context: 'signin',
        use_fedcm_for_prompt: true,
        itp_support: true,
        // By default GIS aborts the prompt on any click elsewhere on the page,
        // including the "Sign in" button. With FedCM that abort rejects the
        // browser request and GIS logs "FedCM get() rejects with AbortError"
        // as a console error, so leave the prompt alone and let the visitor
        // dismiss it themselves.
        cancel_on_tap_outside: false,
        nonce: hashedNonce,
        callback: async response => {
          const supabase = createClient()
          const { error } = await supabase.auth.signInWithIdToken({
            provider: 'google',
            token: response.credential,
            nonce,
          })
          if (error) {
            console.error('Google One Tap sign-in failed:', error.message)
            return
          }
          onSignedIn?.()
        },
      })
      window.google.accounts.id.prompt(notification => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          console.debug(
            'Google One Tap not shown:',
            notification.getNotDisplayedReason?.() ||
              notification.getSkippedReason?.(),
          )
        }
      })
    })()

    return () => {
      cancelled = true
    }
  }, [enabled, scriptReady, onSignedIn])

  if (!GOOGLE_CLIENT_ID) return null

  return (
    <Script
      src="https://accounts.google.com/gsi/client"
      strategy="afterInteractive"
      onReady={() => setScriptReady(true)}
    />
  )
}
