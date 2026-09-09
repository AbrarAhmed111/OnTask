'use client'

import Image from 'next/image'
import fullLogo from '@/assets/img/Full-logo.png'
import { Settings2 } from 'lucide-react'

export function Header({ onSettings }: { onSettings: () => void }) {
  return (
    <header className="mx-auto flex h-[76px] w-[min(1120px,calc(100%-32px))] items-center justify-between border-b border-line">
      <Image
        src={fullLogo}
        alt="OnTask"
        priority
        className="h-11 w-[122px] rounded-xl bg-forest px-2.5 py-1.5 object-contain"
      />
      <div className="flex items-center gap-2.5">
        <div className="hidden items-center gap-2 rounded-full border border-line bg-white/60 px-3 py-2 text-[11px] text-muted sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-coral" /> Today{' '}
          <b className="text-ink">
            {new Date().toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </b>
        </div>
        <button
          aria-label="Settings"
          onClick={onSettings}
          className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-white/60 text-forest transition hover:border-forest"
        >
          <Settings2 size={17} />
        </button>
      </div>
    </header>
  )
}
