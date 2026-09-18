'use client'

import Image from 'next/image'
import Link from 'next/link'
import fullLogo from '@/assets/img/Full-logo.png'
import { Home, Settings2, Users } from 'lucide-react'
import { AccountMenu } from '@/components/layout/AccountMenu'
import { Avatar } from '@/components/ui/Avatar'
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
  homeHref = '/',
  homeLabel = 'Go to the OnTask home page',
}: {
  // Omit to hide the settings button (the workspaces hub has no settings of
  // its own — each workspace has its own).
  onSettings?: () => void
  user: AuthUser | null
  authReady: boolean
  onOpenAuth: () => void
  onOpenWorkspaces: () => void
  onLogout: () => void
  pendingInvitationCount?: number
  // Which page this header is on — swaps the nav button's destination so it
  // always points at "the other place" instead of linking back to the page
  // you're already viewing. `personal` is the guest page (its button opens
  // sign-in to reach workspaces); `workspaces` is the signed-in hub (its
  // button opens the Personal Workspace).
  context?: 'personal' | 'workspaces'
  // Where the logo links. The guest page and the hub differ: signed-in users
  // clicking the logo on the hub should stay on the hub, not be bounced on to
  // their Personal Workspace by the `/` redirect.
  homeHref?: string
  homeLabel?: string
}) {
  return (
    <header className="mx-auto flex h-[76px] w-[min(1120px,calc(100%-32px))] items-center justify-between border-b border-line">
      <Link href={homeHref} aria-label={homeLabel}>
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
              ? 'Go to your Personal Workspace'
              : 'Log in to open your workspaces'
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
              <span className="hidden sm:inline">Workspaces</span>
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
        {authReady && user ? (
          <AccountMenu
            user={user}
            onLogout={onLogout}
            renderTrigger={({ toggle }) => (
              <button
                aria-label="Account menu"
                onClick={toggle}
                className="h-9 w-9 overflow-hidden rounded-full border border-line transition hover:border-forest"
              >
                <Avatar person={user} className="h-full w-full text-xs" />
              </button>
            )}
          />
        ) : (
          <button
            onClick={onOpenAuth}
            className="rounded-full bg-forest px-3.5 py-2 text-[11px] font-semibold text-white transition hover:bg-forest/90"
          >
            Sign in
          </button>
        )}
        {onSettings && (
          <button
            aria-label="Settings"
            onClick={onSettings}
            className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-white/60 text-forest transition hover:border-forest"
          >
            <Settings2 size={17} />
          </button>
        )}
      </div>
    </header>
  )
}
