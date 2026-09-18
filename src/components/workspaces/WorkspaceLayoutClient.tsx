'use client'

import { ReactNode, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { useWorkspace } from '@/hooks/useWorkspace'
import { useWorkspaceInvitations } from '@/hooks/useWorkspaceInvitations'
import { useWorkspacePresence } from '@/hooks/useWorkspacePresence'
import { usePersonalWelcome } from '@/hooks/usePersonalWelcome'
import { InviteMemberModal } from '@/components/workspaces/InviteMemberModal'
import { PersonalWelcomeModal } from '@/components/workspaces/PersonalWelcomeModal'
import { GuestWorkPrompt } from '@/components/auth/GuestWorkPrompt'
import {
  WorkspaceShell,
  WorkspaceSection,
} from '@/components/workspaces/WorkspaceShell'
import {
  WorkspaceDetailContext,
  WorkspaceDetailContextValue,
} from '@/components/workspaces/WorkspaceDetailContext'
import type { AuthUser } from '@/hooks/useAuth'
import { PERSONAL_WORKSPACE_SLUG } from '@/lib/workspaces'

// The section a pathname like /workspaces/[slug], /workspaces/[slug]/members
// or /workspaces/[slug]/settings maps to — derived from the URL (instead of
// component state) so the sidebar, the URL bar, and a page refresh all agree
// on which page is open.
function sectionFromPathname(pathname: string): WorkspaceSection {
  if (pathname.endsWith('/members')) return 'members'
  if (pathname.endsWith('/settings')) return 'settings'
  return 'overview'
}

export function WorkspaceLayoutClient({
  workspaceSlug,
  children,
}: {
  workspaceSlug: string
  children: ReactNode
}) {
  const { user, ready: authReady, handleLogout } = useAuthGuard()

  if (!authReady || !user) {
    return <main className="min-h-screen bg-paper" />
  }

  return (
    <WorkspaceLayout
      workspaceSlug={workspaceSlug}
      user={user}
      onLogout={handleLogout}
    >
      {children}
    </WorkspaceLayout>
  )
}

function WorkspaceLayout({
  workspaceSlug,
  user,
  onLogout,
  children,
}: {
  workspaceSlug: string
  user: AuthUser
  onLogout: () => void
  children: ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const section = sectionFromPathname(pathname)
  const {
    workspace,
    members,
    role,
    ready,
    error,
    updateWorkspace,
    removeMember,
  } = useWorkspace(workspaceSlug, user)
  // The real workspace uuid, once resolved -- every downstream hook below
  // (and everything handed down via context) keys off this, never the URL
  // slug, since that's what workspace_id FKs and realtime filters expect.
  const workspaceId = workspace?.id ?? ''
  // Known from the URL alone before the workspace row has loaded, so the
  // shell can render the personal header (and skip collaboration-only work)
  // from the very first paint.
  const isPersonal = workspace
    ? workspace.type === 'personal'
    : workspaceSlug === PERSONAL_WORKSPACE_SLUG
  // A personal workspace has no invitations and only ever one member (you),
  // so its invitation list and presence channel are never even opened.
  const collaborationWorkspaceId = isPersonal ? '' : workspaceId
  const {
    invitations,
    ready: invitationsReady,
    inviteByEmail,
    cancelInvitation,
    deleteInvitation,
  } = useWorkspaceInvitations(collaborationWorkspaceId, user)
  const onlineUserIds = useWorkspacePresence(collaborationWorkspaceId, user)
  const [inviting, setInviting] = useState(false)
  const welcome = usePersonalWelcome({ user, workspace, updateWorkspace })

  // A personal workspace has exactly one URL. Reaching it through its stored
  // slug (an old link, a notification) or through the members page — which a
  // personal workspace doesn't have — lands back on the canonical page.
  useEffect(() => {
    if (!workspace || workspace.type !== 'personal') return
    if (workspaceSlug !== PERSONAL_WORKSPACE_SLUG) {
      router.replace(`/workspaces/${PERSONAL_WORKSPACE_SLUG}`)
    } else if (section === 'members') {
      router.replace(`/workspaces/${PERSONAL_WORKSPACE_SLUG}`)
    }
  }, [workspace, workspaceSlug, section, router])

  if (ready && (error || !workspace)) {
    return (
      <main className="min-h-screen bg-paper">
        <div className="mx-auto flex min-h-screen w-[min(560px,calc(100%-32px))] flex-col items-center justify-center text-center">
          <div className="rounded-2xl border border-coral/20 bg-coral/5 p-6">
            <p className="text-sm font-semibold text-coral">
              {error || 'Workspace not found.'}
            </p>
            <Link
              href="/workspaces"
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-forest hover:text-coral"
            >
              <ArrowLeft size={14} /> Back to Workspaces
            </Link>
          </div>
        </div>
      </main>
    )
  }

  const isOwner = role === 'owner'

  const handleSectionChange = (next: WorkspaceSection) => {
    const base = `/workspaces/${workspace?.slug ?? workspaceSlug}`
    router.push(next === 'overview' ? base : `${base}/${next}`)
  }

  const contextValue: WorkspaceDetailContextValue = {
    workspaceId,
    user,
    workspace,
    members,
    role,
    isOwner,
    isPersonal,
    ready,
    error,
    updateWorkspace,
    removeMember,
    onlineUserIds,
    invitations,
    invitationsReady,
    inviteByEmail,
    cancelInvitation,
    deleteInvitation,
    openInvite: () => setInviting(true),
    onLogout,
  }

  return (
    <WorkspaceDetailContext.Provider value={contextValue}>
      <WorkspaceShell
        workspaceId={workspaceId}
        workspaceSlug={workspace?.slug ?? workspaceSlug}
        workspace={workspace}
        members={members}
        role={role}
        ready={ready}
        user={user}
        onlineUserIds={onlineUserIds}
        section={section}
        onSectionChange={handleSectionChange}
        isPersonal={isPersonal}
        onInvite={isOwner && !isPersonal ? () => setInviting(true) : undefined}
        onLogout={onLogout}
      >
        {children}
      </WorkspaceShell>

      {inviting && !isPersonal && (
        <InviteMemberModal
          onInvite={inviteByEmail}
          onClose={() => setInviting(false)}
        />
      )}
      {isPersonal && welcome.open && (
        <PersonalWelcomeModal onClose={welcome.close} />
      )}
      {isPersonal && ready && (
        <GuestWorkPrompt suppressed={!welcome.checked || welcome.open} />
      )}
    </WorkspaceDetailContext.Provider>
  )
}
