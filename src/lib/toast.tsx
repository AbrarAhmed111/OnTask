'use client'

import toast from 'react-hot-toast'
import { AlertTriangle, Check } from 'lucide-react'

// Custom-rendered toasts styled to match the app's own card language
// (rounded-2xl panel, forest/coral accents) rather than react-hot-toast's
// plain default bubble — still flows through the same <Toaster/> mounted in
// the root layout, so position/stacking/dismiss timing all just work.
export function showSuccessToast(message: string) {
  toast.custom(
    t => (
      <div
        className={`flex items-center gap-3 rounded-2xl border border-line bg-panel px-4 py-3.5 shadow-xl ${t.visible ? 'animate-[fadeIn_180ms_ease-out]' : 'opacity-0'}`}
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-forest text-white">
          <Check size={15} />
        </span>
        <p className="text-xs font-semibold text-ink">{message}</p>
      </div>
    ),
    { duration: 4000 },
  )
}

export function showErrorToast(message: string) {
  toast.custom(
    t => (
      <div
        className={`flex items-center gap-3 rounded-2xl border border-coral/20 bg-panel px-4 py-3.5 shadow-xl ${t.visible ? 'animate-[fadeIn_180ms_ease-out]' : 'opacity-0'}`}
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-coral text-white">
          <AlertTriangle size={15} />
        </span>
        <p className="text-xs font-semibold text-ink">{message}</p>
      </div>
    ),
    { duration: 5000 },
  )
}
