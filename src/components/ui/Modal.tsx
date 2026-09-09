'use client'

import { ReactNode, useEffect } from 'react'
import { X } from 'lucide-react'

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
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) =>
      event.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm animate-[fadeIn_180ms_ease-out]"
      onMouseDown={event => event.target === event.currentTarget && onClose()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="w-full max-w-md rounded-2xl border border-line bg-panel p-6 shadow-2xl animate-[modalIn_220ms_ease-out]"
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
