'use client'

import { CSSProperties, ReactNode, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  ChevronDown,
  Clock,
  LayoutDashboard,
  LogOut,
  Settings2,
  UserPlus,
  Users,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import { PresenceDot } from '@/components/workspaces/PresenceDot'
import { getWorkspaceTheme } from '@/lib/workspaceThemes'
import type { AuthUser } from '@/hooks/useAuth'
import { Workspace, WorkspaceMember, WorkspaceRole } from '@/types/workspace'

export type WorkspaceSection = 'overview' | 'members' | 'settings'

const NAV_ITEMS: {
  id: WorkspaceSection
  label: string
  icon: typeof LayoutDashboard
  ownerOnly?: boolean
}[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'members', label: 'Members', icon: Users },
  { id: 'settings', label: 'Settings', icon: Settings2, ownerOnly: true },
]

const HEADER_PREVIEW_COUNT = 5
const COMPACT_PREVIEW_COUNT = 3

// The sidebar itself only exists from `sm:` up (mobile gets a horizontal tab
// bar instead), so below that breakpoint the header's back-button column
// only ever needs to be as wide as the button — reserving the full rail
// width there would waste most of the header on empty space.
const RAIL_WIDTH = 'w-14 sm:w-[68px]'

function MemberAvatar({
  member,
  online,
  className = 'h-7 w-7 text-[9px]',
}: {
  member: WorkspaceMember
  online: boolean
  className?: string
}) {
  return (
    <div
      title={member.fullName || member.email || 'Member'}
      className={`relative shrink-0 ${className}`}
    >
      <div className="grid h-full w-full place-items-center overflow-hidden rounded-full border-2 border-paper bg-[var(--ws-accent,#375b4b)] font-bold text-white">
        {member.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={member.avatarUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
          />
        ) : (
          (member.fullName || member.email || '?').charAt(0).toUpperCase()
        )}
      </div>
      <PresenceDot online={online} />
    </div>
  )
}

// Avatar + first-name pill used in the header's centered member row — wide
// screens only, where there's room to actually name people instead of just
// showing faces.
function MemberChip({
  member,
  online,
}: {
  member: WorkspaceMember
  online: boolean
}) {
  const firstName = (member.fullName || member.email || 'Member').split(' ')[0]
  return (
    <div className="flex shrink-0 items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5">
      <MemberAvatar
        member={member}
        online={online}
        className="h-6 w-6 text-[9px]"
      />
      <span
        title={member.fullName || member.email || 'Member'}
        className="max-w-[88px] truncate text-[11px] font-semibold text-ink"
      >
        {firstName}
      </span>
    </div>
  )
}

// Full-bleed app-style shell for a single workspace: a workspace-context top
// bar (greeting, workspace detail line, member preview, quick invite,
// account menu) plus a collapsible icon rail for Overview/Settings — this is
// meant to feel like a dedicated collaborative workspace, not another page
// of the app. The rail and the header's back-button column share the exact
// same fixed width so they always line up as one visual column, regardless
// of viewport width or browser zoom (a max-width/mx-auto wrapper around
// both would drift out of alignment whenever the viewport crosses that
// breakpoint — this avoids that by never centering the shell itself).
export function WorkspaceShell({
  workspace,
  members,
  role,
  ready,
  user,
  onlineUserIds,
  section,
  onSectionChange,
  onInvite,
  onLogout,
  children,
}: {
  workspace: Workspace | null
  members: WorkspaceMember[]
  role: WorkspaceRole | null
  ready: boolean
  user: AuthUser
  onlineUserIds: Set<string>
  section: WorkspaceSection
  onSectionChange: (section: WorkspaceSection) => void
  onInvite?: () => void
  onLogout: () => void
  children: ReactNode
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const id = window.setInterval(() => setNow(new Date()), 30000)
    return () => window.clearInterval(id)
  }, [])

  const isOwner = role === 'owner'
  const theme = getWorkspaceTheme(workspace?.accent)
  const items = NAV_ITEMS.filter(item => !item.ownerOnly || isOwner)
  const headerPreview = members.slice(0, HEADER_PREVIEW_COUNT)
  const headerOverflow = members.length - headerPreview.length
  const compactPreview = members.slice(0, COMPACT_PREVIEW_COUNT)
  const compactOverflow = members.length - compactPreview.length
  const workspaceTime =
    workspace?.timezone && now
      ? new Intl.DateTimeFormat('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          timeZoneName: 'short',
          timeZone: workspace.timezone,
        }).format(now)
      : null

  return (
    <div
      style={
        {
          '--ws-accent': theme.strong,
          '--ws-accent-soft': theme.soft,
        } as CSSProperties
      }
      className="min-h-screen bg-[radial-gradient(circle_at_80%_0%,#e4f0e6_0,transparent_30%),linear-gradient(135deg,#f8faf7_0%,#eff3ee_100%)] text-ink"
    >
      <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur">
        <div className="relative flex h-20 items-stretch">
          <div
            className={`flex shrink-0 items-center justify-center ${RAIL_WIDTH}`}
          >
            <Link
              href="/workspaces"
              aria-label="Back to Shared Workspaces"
              className="grid h-9 w-9 place-items-center rounded-lg text-muted transition hover:bg-slate-100 hover:text-ink"
            >
              <ArrowLeft size={17} />
            </Link>
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-3 pr-4 sm:pr-6">
            <div className="min-w-0 max-w-[48%] shrink-0 sm:max-w-[44%]">
              {!ready ? (
                <>
                  <Skeleton className="h-2.5 w-32" />
                  <Skeleton className="mt-2 h-7 w-48" />
                </>
              ) : (
                <>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-coral">
                    Let&apos;s start working in
                  </p>
                  <h1 className="truncate text-3xl font-extrabold capitalize tracking-tight text-ink">
                    {workspace?.name}
                  </h1>
                </>
              )}
            </div>

            {ready && members.length > 0 && (
              <button
                onClick={() => onSectionChange('members')}
                aria-label="View all members"
                className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-1 rounded-full border border-line bg-white/60 px-2 py-1.5 shadow-sm transition hover:border-[var(--ws-accent,#375b4b)] hover:bg-white/90 lg:flex"
              >
                {headerPreview.map(member => (
                  <MemberChip
                    key={member.id}
                    member={member}
                    online={onlineUserIds.has(member.userId)}
                  />
                ))}
                {headerOverflow > 0 && (
                  <span className="ml-1 shrink-0 rounded-full bg-[var(--ws-accent,#375b4b)] px-2.5 py-1.5 text-[11px] font-bold text-white">
                    +{headerOverflow} more
                  </span>
                )}
              </button>
            )}

            <div className="ml-auto flex shrink-0 items-center gap-2.5">
              {ready && members.length > 0 && (
                <button
                  onClick={() => onSectionChange('members')}
                  aria-label="View all members"
                  className="hidden items-center rounded-full transition hover:opacity-80 sm:flex lg:hidden"
                >
                  <div className="flex -space-x-2">
                    {compactPreview.map(member => (
                      <MemberAvatar
                        key={member.id}
                        member={member}
                        online={onlineUserIds.has(member.userId)}
                      />
                    ))}
                  </div>
                  {compactOverflow > 0 && (
                    <span
                      title={`${compactOverflow} more ${compactOverflow === 1 ? 'member' : 'members'}`}
                      className="-ml-2 grid h-7 w-7 place-items-center rounded-full border-2 border-paper bg-slate-200 font-mono text-[10px] font-bold text-muted"
                    >
                      &hellip;
                    </span>
                  )}
                </button>
              )}
              {workspaceTime && (
                <div
                  title={workspace?.timezone}
                  className="hidden items-center gap-1.5 rounded-full border border-line bg-white/60 px-3 py-1.5 text-[11px] font-semibold text-muted md:flex"
                >
                  <Clock
                    size={13}
                    className="shrink-0 text-[var(--ws-accent,#375b4b)]"
                  />
                  <span className="tabular-nums">{workspaceTime}</span>
                </div>
              )}
              {isOwner && onInvite && (
                <button
                  onClick={onInvite}
                  className="hidden items-center gap-1.5 rounded-full border border-line bg-white/60 px-3 py-1.5 text-[11px] font-semibold text-[var(--ws-accent,#375b4b)] transition hover:border-[var(--ws-accent,#375b4b)] sm:flex"
                >
                  <UserPlus size={13} /> Invite
                </button>
              )}
              <div className="relative">
                <button
                  aria-label="Account menu"
                  onClick={() => setMenuOpen(open => !open)}
                  className="flex items-center gap-1.5 rounded-full border border-line bg-white/70 py-1 pl-1 pr-2 transition hover:border-[var(--ws-accent,#375b4b)]"
                >
                  <span className="grid h-7 w-7 place-items-center overflow-hidden rounded-full bg-[var(--ws-accent,#375b4b)] text-[10px] font-bold text-white">
                    {user.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={user.avatarUrl}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      (user.fullName || user.email || '?')
                        .charAt(0)
                        .toUpperCase()
                    )}
                  </span>
                  <span className="hidden max-w-[100px] truncate text-xs font-semibold text-ink md:inline">
                    {(user.fullName || user.email || 'Account').split(' ')[0]}
                  </span>
                  <ChevronDown
                    size={14}
                    className={`text-muted transition-transform ${menuOpen ? 'rotate-180' : ''}`}
                  />
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
                      <Link
                        href="/workspaces"
                        onClick={() => setMenuOpen(false)}
                        className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-ink transition hover:bg-slate-100"
                      >
                        <Users size={14} /> All workspaces
                      </Link>
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
            </div>
          </div>
        </div>
        {items.length > 1 && (
          <nav className="flex gap-1 overflow-x-auto border-t border-line/70 px-3 py-2 sm:hidden">
            {items.map(item => {
              const Icon = item.icon
              const active = section === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => onSectionChange(item.id)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
                    active
                      ? 'bg-[var(--ws-accent,#375b4b)] text-white'
                      : 'text-muted hover:bg-slate-100'
                  }`}
                >
                  <Icon size={13} /> {item.label}
                </button>
              )
            })}
          </nav>
        )}
      </header>

      <div className="flex">
        <aside
          className={`sticky top-20 hidden h-[calc(100vh-5rem)] shrink-0 flex-col gap-1 border-r border-line/70 px-2 py-4 sm:flex ${RAIL_WIDTH}`}
        >
          <nav className="flex flex-1 flex-col gap-1">
            {items.map(item => {
              const Icon = item.icon
              const active = section === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => onSectionChange(item.id)}
                  title={item.label}
                  className={`flex items-center justify-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition ${
                    active
                      ? 'bg-[var(--ws-accent,#375b4b)] text-white shadow-sm'
                      : 'text-muted hover:bg-slate-100 hover:text-ink'
                  }`}
                >
                  <Icon size={16} className="shrink-0" />
                </button>
              )
            })}
          </nav>
        </aside>

        <div className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8 lg:px-10">
          <div className="mx-auto w-full max-w-[1600px]">
            <div key={section} className="animate-[fadeIn_200ms_ease-out]">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
