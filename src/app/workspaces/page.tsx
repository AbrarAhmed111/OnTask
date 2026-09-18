'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CirclePlus, Mail, Users, X } from 'lucide-react'
import { WorkspacePageShell } from '@/components/layout/WorkspacePageShell'
import { WorkspaceCard } from '@/components/workspaces/WorkspaceCard'
import { PersonalWorkspaceCard } from '@/components/workspaces/PersonalWorkspaceCard'
import { CreateWorkspaceModal } from '@/components/workspaces/CreateWorkspaceModal'
import { RejectInvitationModal } from '@/components/workspaces/RejectInvitationModal'
import { GuestWorkPrompt } from '@/components/auth/GuestWorkPrompt'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { useWorkspaces } from '@/hooks/useWorkspaces'
import { useMyInvitations } from '@/hooks/useMyInvitations'
import { clientSignout } from '@/lib/auth/signout'
import { showSuccessToast } from '@/lib/toast'
import type { AuthUser } from '@/hooks/useAuth'
import { WorkspaceInvitation } from '@/types/workspace'

function WorkspaceCardSkeleton() {
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-line bg-panel p-5 shadow-sm sm:p-6">
      <div>
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="mt-2.5 h-3 w-full" />
        <Skeleton className="mt-1.5 h-3 w-4/5" />
      </div>
      <div className="mt-6 flex items-center justify-between">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  )
}

export default function WorkspacesPage() {
  return (
    <WorkspacePageShell>
      {({ user }) => <WorkspacesContent user={user} />}
    </WorkspacePageShell>
  )
}

// The authenticated user's home: "which workspace do I want to work in?".
// Pending invitations first (they need an answer), then the always-there
// Personal Workspace, then the shared workspaces they belong to.
function WorkspacesContent({ user }: { user: AuthUser }) {
  const { workspaces, memberCounts, ready, error, createWorkspace, reload } =
    useWorkspaces(user)
  const {
    invitations,
    ready: invitationsReady,
    respond,
  } = useMyInvitations(user)
  const [creating, setCreating] = useState(false)
  const [rejecting, setRejecting] = useState<WorkspaceInvitation | null>(null)
  const [respondingId, setRespondingId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  // Captured once on mount (then stripped from the URL) so it survives even
  // after the query string is cleaned up — an invitation link (email, or
  // forwarded through sign-in) lands here as ?invite=&workspace=&email=.
  const [inviteLink, setInviteLink] = useState<{
    id: string
    workspaceName: string | null
    invitedEmail: string | null
  } | null>(null)
  const [switchingAccount, setSwitchingAccount] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const invite = params.get('invite')
    if (!invite) return
    setInviteLink({
      id: invite,
      workspaceName: params.get('workspace'),
      invitedEmail: params.get('email'),
    })
    window.history.replaceState(null, '', window.location.pathname)
  }, [])

  // The invited address is embedded in the link itself (see
  // send-email/route.ts), so a visitor who's signed in as a *different*
  // account can be told that directly — the database only ever returns
  // invitations addressed to the signed-in account, which would otherwise
  // look identical to "this invitation no longer exists."
  const accountMismatch =
    !!inviteLink?.invitedEmail &&
    !!user.email &&
    inviteLink.invitedEmail.toLowerCase() !== user.email.toLowerCase()

  useEffect(() => {
    if (!inviteLink || !invitationsReady || accountMismatch) return
    if (!invitations.some(invitation => invitation.id === inviteLink.id)) {
      setNotice(
        "That invitation isn't pending anymore — it may already have been accepted, declined, or cancelled.",
      )
    }
  }, [inviteLink, invitationsReady, invitations, accountMismatch])

  const handleSwitchAccount = async () => {
    if (!inviteLink) return
    setSwitchingAccount(true)
    await clientSignout()
    const params = new URLSearchParams({ invite: inviteLink.id })
    if (inviteLink.workspaceName)
      params.set('workspace', inviteLink.workspaceName)
    if (inviteLink.invitedEmail) params.set('email', inviteLink.invitedEmail)
    // A hard navigation, not router.push — useAuthGuard's own redirect
    // effect fires the instant `user` goes null too, and a client-side
    // push here could lose this race and land on a bare "/" with the
    // invite context dropped. This also guarantees a clean auth state for
    // whichever account logs in next.
    window.location.href = `/?${params.toString()}`
  }

  useEffect(() => {
    if (error) setNotice(error)
  }, [error])

  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(''), 5000)
    return () => window.clearTimeout(timeout)
  }, [notice])

  // Accepting joins the shared workspace through the existing membership
  // system (accept_workspace_invitation) and leaves the user right here, with
  // the new workspace now in the list below. Nothing is ever accepted
  // implicitly — only this explicit click gets here.
  const handleAccept = async (invitation: WorkspaceInvitation) => {
    setRespondingId(invitation.id)
    const result = await respond(invitation.id, 'accept')
    setRespondingId(null)
    if (!result.success) {
      setNotice(result.error || 'Failed to accept invitation.')
      return
    }
    showSuccessToast(
      `You joined "${invitation.workspaceName || 'the workspace'}".`,
    )
    reload()
  }

  const handleReject = async (reason: string) => {
    if (!rejecting) return { success: false, error: 'Nothing to reject.' }
    const result = await respond(rejecting.id, 'reject', reason)
    if (result.success) {
      showSuccessToast(
        `Declined the invitation to "${rejecting.workspaceName}".`,
      )
    }
    return result
  }

  return (
    <>
      <div className="mb-8">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-coral">
          Your workspaces
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          Choose a workspace
        </h1>
        <p className="mt-2 max-w-md text-xs leading-5 text-muted">
          Work privately in your Personal Workspace, or jump into a shared one
          to collaborate.
        </p>
      </div>
      {notice && (
        <div className="mb-6 rounded-xl border border-coral/20 bg-coral/5 px-4 py-3 text-xs text-coral animate-[fadeIn_180ms_ease-out]">
          {notice}
        </div>
      )}
      {accountMismatch && inviteLink && (
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-coral/30 bg-coral/5 p-5 animate-[fadeIn_180ms_ease-out] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-coral" />
            <p className="text-xs leading-5 text-coral">
              The invitation to{' '}
              <strong>{inviteLink.workspaceName || 'this workspace'}</strong>{' '}
              was sent to <strong>{inviteLink.invitedEmail}</strong>, but
              you&apos;re signed in as <strong>{user.email}</strong>. Log out
              and sign in with that address to accept it, or ask the workspace
              owner to invite <strong>{user.email}</strong> instead.
            </p>
          </div>
          <Button
            variant="secondary"
            className="shrink-0"
            disabled={switchingAccount}
            onClick={handleSwitchAccount}
          >
            Log out &amp; switch account
          </Button>
        </div>
      )}

      {invitationsReady && invitations.length > 0 && (
        <section
          aria-label="Workspace invitations"
          className="mb-8 rounded-2xl border border-sage/40 bg-sage/5 p-5 animate-[fadeIn_220ms_ease-out] sm:p-6"
        >
          <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.1em] text-forest">
            <Mail size={14} /> Workspace Invitations
            <span className="font-mono font-normal normal-case tracking-normal text-muted">
              {invitations.length}
            </span>
          </h2>
          <div className="space-y-3">
            {invitations.map(invitation => (
              <div
                key={invitation.id}
                ref={element => {
                  if (element && invitation.id === inviteLink?.id) {
                    element.scrollIntoView({
                      behavior: 'smooth',
                      block: 'center',
                    })
                  }
                }}
                className={`flex flex-col gap-3 rounded-xl border bg-panel p-4 transition sm:flex-row sm:items-center sm:justify-between ${
                  invitation.id === inviteLink?.id
                    ? 'border-forest ring-4 ring-sage/25'
                    : 'border-line'
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-ink">
                    {invitation.workspaceName || 'A workspace'}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    Invited by{' '}
                    <span className="font-semibold text-ink">
                      {invitation.inviterName || 'a teammate'}
                    </span>
                  </p>
                  {invitation.message && (
                    <p className="mt-1.5 text-xs italic leading-5 text-muted">
                      &ldquo;{invitation.message}&rdquo;
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    onClick={() => handleAccept(invitation)}
                    disabled={respondingId === invitation.id}
                  >
                    Accept
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={respondingId === invitation.id}
                    onClick={() => setRejecting(invitation)}
                  >
                    <X size={14} /> Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section aria-label="Personal Workspace" className="mb-10">
        <PersonalWorkspaceCard />
      </section>

      <section aria-label="Shared Workspaces">
        <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-ink">
              Shared Workspaces{' '}
              {ready ? (
                <span className="font-mono text-sm font-normal text-muted">
                  {workspaces.length}
                </span>
              ) : (
                <Skeleton className="inline-block h-4 w-5 align-middle" />
              )}
            </h2>
            <p className="mt-1 max-w-md text-xs leading-5 text-muted">
              Plan together, assign tasks, and track focus time as a team — each
              workspace keeps its own tasks, members, and activity feed.
            </p>
          </div>
          <Button className="self-start" onClick={() => setCreating(true)}>
            <CirclePlus size={16} /> Create Workspace
          </Button>
        </div>
        {!ready ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map(i => (
              <WorkspaceCardSkeleton key={i} />
            ))}
          </div>
        ) : workspaces.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-sage/70 px-6 py-12 text-center animate-[fadeIn_220ms_ease-out]">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-sage/10 text-forest">
              <Users size={22} />
            </div>
            <div>
              <p className="text-sm font-bold text-ink">
                No shared workspaces yet
              </p>
              <p className="mt-1 max-w-xs text-xs leading-5 text-muted">
                Want to work with others? Create a shared workspace and invite
                your team — your Personal Workspace stays yours either way.
              </p>
            </div>
            <Button onClick={() => setCreating(true)}>
              <CirclePlus size={16} /> Create Workspace
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 animate-[fadeIn_220ms_ease-out] sm:grid-cols-2 lg:grid-cols-3">
            {workspaces.map(workspace => (
              <WorkspaceCard
                key={workspace.id}
                workspace={workspace}
                memberCount={memberCounts[workspace.id] ?? 1}
              />
            ))}
          </div>
        )}
      </section>

      {creating && (
        <CreateWorkspaceModal
          onCreate={createWorkspace}
          onClose={() => setCreating(false)}
        />
      )}
      {rejecting && (
        <RejectInvitationModal
          workspaceName={rejecting.workspaceName || 'this workspace'}
          onReject={handleReject}
          onClose={() => setRejecting(null)}
        />
      )}
      <GuestWorkPrompt />
    </>
  )
}
