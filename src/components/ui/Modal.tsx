'use client'

import { ReactNode, useEffect, useRef } from 'react'
import { X } from 'lucide-react'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Modal({
  title,
  eyebrow,
  children,
  onClose,
}: {
  title: string
  eyebrow?: string
  children: ReactNode
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null

    // Don't steal focus from a field that already autofocused itself (React
    // commits child effects, including the native `autofocus` attribute,
    // before this parent effect runs) — only take over if nothing inside
    // the dialog has focus yet.
    if (!dialogRef.current?.contains(document.activeElement)) {
      const focusables =
        dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ;(focusables?.[0] ?? dialogRef.current)?.focus()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab') return

      const focusables = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ??
          [],
      )
      if (focusables.length === 0) {
        event.preventDefault()
        return
      }
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement

      if (event.shiftKey) {
        if (active === first || !dialogRef.current?.contains(active)) {
          event.preventDefault()
          last.focus()
        }
      } else if (active === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      const previouslyFocused = previouslyFocusedRef.current
      if (previouslyFocused && document.body.contains(previouslyFocused)) {
        previouslyFocused.focus()
      }
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm animate-[fadeIn_180ms_ease-out]"
      onMouseDown={event => event.target === event.currentTarget && onClose()}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        className="w-full max-w-md rounded-2xl border border-line bg-panel p-6 shadow-2xl outline-none animate-[modalIn_220ms_ease-out]"
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            {eyebrow && (
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-coral">
                {eyebrow}
              </p>
            )}
            <h2
              id="modal-title"
              className="text-xl font-bold tracking-tight text-ink"
            >
              {title}
            </h2>
          </div>
          <button
            aria-label="Close dialog"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted transition hover:bg-slate-100 hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </section>
    </div>
  )
}
