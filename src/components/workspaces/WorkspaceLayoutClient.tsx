'use client'

import { ReactNode, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { useWorkspace } from '@/hooks/useWorkspace'
import { useWorkspaceInvitations } from '@/hooks/useWorkspaceInvitations'
import { useWorkspacePresence } from '@/hooks/useWorkspacePresence'
import { InviteMemberModal } from '@/components/workspaces/InviteMemberModal'
import {
  WorkspaceShell,
  WorkspaceSection,
} from '@/components/workspaces/WorkspaceShell'
import {
  WorkspaceDetailContext,
  WorkspaceDetailContextValue,
} from '@/components/workspaces/WorkspaceDetailContext'
import type { AuthUser } from '@/hooks/useAuth'

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
  const {
    invitations,
    ready: invitationsReady,
    inviteByEmail,
    cancelInvitation,
    deleteInvitation,
  } = useWorkspaceInvitations(workspaceId, user)
  const onlineUserIds = useWorkspacePresence(workspaceId, user)
  const [inviting, setInviting] = useState(false)

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
              <ArrowLeft size={14} /> Back to Shared Workspaces
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
        onInvite={isOwner ? () => setInviting(true) : undefined}
        onLogout={onLogout}
      >
        {children}
      </WorkspaceShell>

      {inviting && (
        <InviteMemberModal
          onInvite={inviteByEmail}
          onClose={() => setInviting(false)}
        />
      )}
    </WorkspaceDetailContext.Provider>
  )
}
