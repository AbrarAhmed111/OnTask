import {
  AlertTriangle,
  LogOut,
  Mail,
  Trash2,
  UserMinus,
  UserPlus,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { PresenceDot } from '@/components/workspaces/PresenceDot'
import { WorkspaceInvitation, WorkspaceMember } from '@/types/workspace'

const THEMED_INVITATION_STATUS_STYLE =
  'bg-[var(--ws-accent-soft,#e9f0ec)] text-[var(--ws-accent,#375b4b)]'
const INVITATION_STATUS_STYLE: Record<string, string> = {
  pending: THEMED_INVITATION_STATUS_STYLE,
  accepted: THEMED_INVITATION_STATUS_STYLE,
  rejected: 'bg-coral/10 text-coral',
  expired: 'bg-slate-100 text-muted',
  cancelled: 'bg-slate-100 text-muted',
}

function MemberRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="mt-1.5 h-2.5 w-1/2" />
      </div>
      <Skeleton className="h-4 w-12 shrink-0 rounded-full" />
    </div>
  )
}

export function WorkspaceMembersSection({
  ready,
  error,
  members,
  currentUserId,
  onlineUserIds,
  isOwner,
  onRemoveMember,
  invitationsReady,
  invitations,
  onInvite,
  onCancelInvitation,
  onDeleteInvitation,
  onLeave,
}: {
  ready: boolean
  error?: string | null
  members: WorkspaceMember[]
  currentUserId: string
  onlineUserIds: Set<string>
  isOwner: boolean
  onRemoveMember: (member: WorkspaceMember) => void
  invitationsReady: boolean
  invitations: WorkspaceInvitation[]
  onInvite: () => void
  onCancelInvitation: (id: string) => void
  onDeleteInvitation: (id: string) => void
  onLeave: () => void
}) {
  // Every member can see who's still waiting to join — that's just "who's
  // been asked". Rejections (and the reason someone gave) are only the
  // owner's business, so those statuses are filtered out entirely for
  // everyone else rather than just visually hidden.
  const visibleInvitations = isOwner
    ? invitations
    : invitations.filter(invitation => invitation.status === 'pending')

  return (
    <div>
      <div className="rounded-2xl border border-line bg-panel shadow-sm">
        <div className="flex items-center justify-between border-b border-line/70 px-5 py-4">
          <h2 className="text-sm font-bold tracking-tight text-ink">
            Members{' '}
            {ready && (
              <span className="font-mono text-xs font-normal text-muted">
                {members.length}
              </span>
            )}
          </h2>
          {isOwner && (
            <Button variant="secondary" onClick={onInvite}>
              <UserPlus size={14} /> Invite
            </Button>
          )}
        </div>
        {error && (
          <div className="flex items-start gap-2 border-b border-line/70 px-5 py-3 text-xs leading-5 text-coral">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <div className="divide-y divide-line/70">
          {!ready ? (
            <>
              <MemberRowSkeleton />
              <MemberRowSkeleton />
              <MemberRowSkeleton />
            </>
          ) : (
            members.map(member => {
              const initials = (member.fullName || member.email || '?')
                .charAt(0)
                .toUpperCase()
              const online = onlineUserIds.has(member.userId)
              return (
                <div
                  key={member.id}
                  className="flex items-center gap-3 px-5 py-3.5"
                >
                  <div className="relative h-9 w-9 shrink-0">
                    <div className="grid h-full w-full place-items-center overflow-hidden rounded-full border border-line bg-[var(--ws-accent,#375b4b)] text-xs font-bold text-white">
                      {member.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={member.avatarUrl}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        initials
                      )}
                    </div>
                    <PresenceDot online={online} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-ink">
                      {member.fullName || member.email || 'Member'}
                      {member.userId === currentUserId && (
                        <span className="ml-1.5 font-normal text-muted">
                          (you)
                        </span>
                      )}
                    </p>
                    <p className="truncate text-[10px] text-muted">
                      {online ? (
                        <span className="text-emerald-600">Online now</span>
                      ) : (
                        member.email || 'Offline'
                      )}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 font-mono text-[9px] uppercase ${member.role === 'owner' ? 'bg-[var(--ws-accent-soft,#e9f0ec)] text-[var(--ws-accent,#375b4b)]' : 'bg-slate-100 text-muted'}`}
                  >
                    {member.role}
                  </span>
                  {isOwner && member.role !== 'owner' && (
                    <button
                      aria-label={`Remove ${member.fullName || member.email}`}
                      onClick={() => onRemoveMember(member)}
                      className="rounded-lg p-2 text-muted transition hover:bg-coral/10 hover:text-coral"
                    >
                      <UserMinus size={15} />
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {invitationsReady && visibleInvitations.length > 0 && (
        <div className="mt-6 rounded-2xl border border-line bg-panel shadow-sm animate-[fadeIn_200ms_ease-out]">
          <div className="border-b border-line/70 px-5 py-4">
            <h2 className="flex items-center gap-2 text-sm font-bold tracking-tight text-ink">
              <Mail size={15} /> Invitations
            </h2>
          </div>
          <div className="divide-y divide-line/70">
            {visibleInvitations.map(invitation => (
              <div
                key={invitation.id}
                className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-ink">
                    {invitation.invitedEmail}
                  </p>
                  {isOwner && invitation.rejectionReason && (
                    <p className="mt-1 text-[11px] italic leading-5 text-coral">
                      &ldquo;{invitation.rejectionReason}&rdquo;
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 font-mono text-[9px] uppercase ${INVITATION_STATUS_STYLE[invitation.status]}`}
                  >
                    {invitation.status}
                  </span>
                  {isOwner && invitation.status === 'pending' && (
                    <button
                      aria-label={`Cancel invitation to ${invitation.invitedEmail}`}
                      onClick={() => onCancelInvitation(invitation.id)}
                      className="rounded-lg p-1.5 text-muted transition hover:bg-coral/10 hover:text-coral"
                    >
                      <X size={14} />
                    </button>
                  )}
                  {isOwner && invitation.status !== 'pending' && (
                    <button
                      aria-label={`Delete invitation record for ${invitation.invitedEmail}`}
                      title="Delete this record"
                      onClick={() => onDeleteInvitation(invitation.id)}
                      className="rounded-lg p-1.5 text-muted transition hover:bg-coral/10 hover:text-coral"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {ready && !isOwner && (
        <div className="mt-6 flex items-center justify-between rounded-2xl border border-line bg-panel px-5 py-4">
          <div>
            <p className="text-xs font-bold text-ink">Leave this workspace</p>
            <p className="mt-0.5 text-[11px] text-muted">
              You&apos;ll lose access to its tasks and activity.
            </p>
          </div>
          <Button variant="danger" onClick={onLeave}>
            <LogOut size={14} /> Leave
          </Button>
        </div>
      )}
    </div>
  )
}
