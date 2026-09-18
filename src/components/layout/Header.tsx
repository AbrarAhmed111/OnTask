'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import fullLogo from '@/assets/img/Full-logo.png'
import { Home, LogOut, Settings2, Users } from 'lucide-react'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import type { AuthUser } from '@/hooks/useAuth'

export function Header({
  onSettings,
  user,
  authReady,
  onOpenAuth,
  onOpenWorkspaces,
  onLogout,
  pendingInvitationCount = 0,
  context = 'personal',
}: {
  onSettings: () => void
  user: AuthUser | null
  authReady: boolean
  onOpenAuth: () => void
  onOpenWorkspaces: () => void
  onLogout: () => void
  pendingInvitationCount?: number
  // Which page this header is on — swaps the nav button's destination so it
  // always points at "the other place" instead of linking back to the page
  // you're already viewing.
  context?: 'personal' | 'workspaces'
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const initials = (user?.fullName || user?.email || '?')
    .charAt(0)
    .toUpperCase()

  return (
    <header className="mx-auto flex h-[76px] w-[min(1120px,calc(100%-32px))] items-center justify-between border-b border-line">
      <Link href="/" aria-label="Go to your personal dashboard">
        <Image
          src={fullLogo}
          alt="OnTask"
          priority
          className="h-11 w-[122px] rounded-xl bg-forest px-2.5 py-1.5 object-contain"
        />
      </Link>
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
          onClick={onOpenWorkspaces}
          aria-label={
            context === 'workspaces'
              ? 'Go to your personal dashboard'
              : 'Go to Shared Workspaces'
          }
          className="relative flex items-center gap-1.5 rounded-full border border-line bg-white/60 px-2.5 py-2 text-[11px] font-semibold text-forest transition hover:border-forest sm:px-3"
        >
          {context === 'workspaces' ? (
            <>
              <Home size={14} />{' '}
              <span className="hidden sm:inline">Personal</span>
            </>
          ) : (
            <>
              <Users size={14} />{' '}
              <span className="hidden sm:inline">Shared Workspaces</span>
            </>
          )}
          {context !== 'workspaces' && pendingInvitationCount > 0 && (
            <span
              aria-label={`${pendingInvitationCount} pending ${pendingInvitationCount === 1 ? 'invitation' : 'invitations'}`}
              className="grid h-4 min-w-4 place-items-center rounded-full bg-coral px-1 font-mono text-[9px] font-bold text-white"
            >
              {pendingInvitationCount}
            </span>
          )}
        </button>
        {authReady && user && <NotificationBell />}
        {authReady && user ? (
          <div className="relative">
            <button
              aria-label="Account menu"
              onClick={() => setMenuOpen(open => !open)}
              className="grid h-9 w-9 place-items-center overflow-hidden rounded-full border border-line bg-forest text-xs font-bold text-white transition hover:border-forest"
            >
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatarUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              ) : (
                initials
              )}
            </button>
            {menuOpen && (
              <>
                <button
                  aria-hidden
                  tabIndex={-1}
                  className="fixed inset-0 z-40 cursor-default"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 z-50 mt-2 w-52 rounded-xl border border-line bg-panel p-2 shadow-xl animate-[fadeIn_150ms_ease-out]">
                  <div className="border-b border-line/70 px-2.5 py-2">
                    <p className="truncate text-xs font-bold text-ink">
                      {user.fullName || 'Your account'}
                    </p>
                    {user.email && (
                      <p className="truncate text-[10px] text-muted">
                        {user.email}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      onLogout()
                    }}
                    className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-coral transition hover:bg-coral/10"
                  >
                    <LogOut size={14} /> Log out
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <button
            onClick={onOpenAuth}
            className="rounded-full bg-forest px-3.5 py-2 text-[11px] font-semibold text-white transition hover:bg-forest/90"
          >
            Sign in
          </button>
        )}
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
