import Image from 'next/image'
import fullLogo from '@/assets/img/Full-logo.png'
import devAbbyLogo from '@/assets/img/devAbby-fulllogo.png'

export function Footer() {
  return (
    <footer className="mx-auto flex w-[min(1120px,calc(100%-32px))] flex-col gap-5 border-t border-line py-6 text-[10px] text-muted sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col items-start ">
        <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted">
          Built by
        </span>
        <Image
          src={devAbbyLogo}
          alt="DevAbby"
          className="h-16 w-[242px] object-contain"
        />
      </div>
      <div className="flex items-center gap-3">
        <span>Focused work, without the noise.</span>
      </div>
    </footer>
  )
}
