'use client'

import { useEffect, useRef, useState } from 'react'

// Small ring-bordered status dot meant to sit at the bottom-right corner of
// an avatar (parent must be `relative`). Green = has this workspace open
// right now, gray = not currently here. Flipping state briefly ripples so
// whoever's watching the member list catches the change.
export function PresenceDot({ online }: { online: boolean }) {
  const [justChanged, setJustChanged] = useState(false)
  const prevOnline = useRef(online)

  useEffect(() => {
    if (prevOnline.current === online) return
    prevOnline.current = online
    setJustChanged(true)
    const timer = setTimeout(() => setJustChanged(false), 600)
    return () => clearTimeout(timer)
  }, [online])

  const color = online ? 'bg-emerald-500' : 'bg-slate-300'

  return (
    <span className="absolute bottom-0 right-0 h-2.5 w-2.5">
      {justChanged && (
        <span
          className={`absolute inset-0 animate-ping rounded-full ${color}`}
        />
      )}
      <span
        aria-label={online ? 'Online' : 'Offline'}
        title={online ? 'Online now' : 'Not currently here'}
        className={`absolute inset-0 rounded-full border-2 border-paper transition-colors duration-300 ${color}`}
      />
    </span>
  )
}
