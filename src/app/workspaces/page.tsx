'use client'

import { useEffect, useState } from 'react'
import { CirclePlus, Loader2, Mail, Users, X } from 'lucide-react'
import { WorkspacePageShell } from '@/components/layout/WorkspacePageShell'
import { WorkspaceCard } from '@/components/workspaces/WorkspaceCard'
import { CreateWorkspaceModal } from '@/components/workspaces/CreateWorkspaceModal'
import { RejectInvitationModal } from '@/components/workspaces/RejectInvitationModal'
import { Button } from '@/components/ui/Button'
import { useWorkspaces } from '@/hooks/useWorkspaces'
import { useMyInvitations } from '@/hooks/useMyInvitations'
import type { AuthUser } from '@/hooks/useAuth'
import { WorkspaceInvitation } from '@/types/workspace'

export default function WorkspacesPage() {
  return (
    <WorkspacePageShell>
      {({ user }) => <WorkspacesContent user={user} />}
    </WorkspacePageShell>
  )
}

function WorkspacesContent({ user }: { user: AuthUser }) {
  const { workspaces, memberCounts, ready, error, createWorkspace } =
    useWorkspaces(user)
  const {
    invitations,
    ready: invitationsReady,
    respond,
  } = useMyInvitations(user)
  const [creating, setCreating] = useState(false)
  const [rejecting, setRejecting] = useState<WorkspaceInvitation | null>(null)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (error) setNotice(error)
  }, [error])

  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(''), 5000)
    return () => window.clearTimeout(timeout)
  }, [notice])

  const handleAccept = async (invitation: WorkspaceInvitation) => {
    const result = await respond(invitation.id, 'accept')
    if (!result.success) {
      setNotice(result.error || 'Failed to accept invitation.')
      return
    }
    window.location.reload()
  }

  const handleReject = async (reason: string) => {
    if (!rejecting) return { success: false, error: 'Nothing to reject.' }
    const result = await respond(rejecting.id, 'reject', reason)
    if (result.success) {
      setNotice(`Declined the invitation to "${rejecting.workspaceName}".`)
    }
    return result
  }

  if (!ready || !invitationsReady) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted">
        <Loader2 size={22} className="animate-spin text-forest" />
        <p className="text-xs">Loading your workspaces…</p>
      </div>
    )
  }

  return (
    <>
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-coral">
            Work with others
          </p>
          <h1 className="text-2xl font-bold tracking-tight">
            Shared Workspaces{' '}
            <span className="font-mono text-sm font-normal text-muted">
              {workspaces.length}
            </span>
          </h1>
        </div>
        <Button onClick={() => setCreating(true)}>
          <CirclePlus size={16} /> Create workspace
        </Button>
      </div>
      {notice && (
        <div className="mb-6 rounded-xl border border-coral/20 bg-coral/5 px-4 py-3 text-xs text-coral">
          {notice}
        </div>
      )}
      {invitations.length > 0 && (
        <div className="mb-8 rounded-2xl border border-sage/40 bg-sage/5 p-5 sm:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.1em] text-forest">
            <Mail size={14} /> Pending invitations
          </h2>
          <div className="space-y-3">
            {invitations.map(invitation => (
              <div
                key={invitation.id}
                className="flex flex-col gap-3 rounded-xl border border-line bg-panel p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-ink">
                    {invitation.workspaceName || 'A workspace'}
                  </p>
                  {invitation.message && (
                    <p className="mt-1 text-xs italic leading-5 text-muted">
                      &ldquo;{invitation.message}&rdquo;
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button onClick={() => handleAccept(invitation)}>
                    Accept
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setRejecting(invitation)}
                  >
                    <X size={14} /> Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {workspaces.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-sage/70 px-6 py-16 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-sage/10 text-forest">
            <Users size={22} />
          </div>
          <div>
            <p className="text-sm font-bold text-ink">No workspaces yet</p>
            <p className="mt-1 max-w-xs text-xs leading-5 text-muted">
              Create one to start planning and tracking focus time with others.
            </p>
          </div>
          <Button onClick={() => setCreating(true)}>
            <CirclePlus size={16} /> Create your first workspace
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map(workspace => (
            <WorkspaceCard
              key={workspace.id}
              workspace={workspace}
              memberCount={memberCounts[workspace.id] ?? 1}
            />
          ))}
        </div>
      )}
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
    </>
  )
}
