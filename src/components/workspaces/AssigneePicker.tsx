'use client'

import { useState } from 'react'
import { ChevronDown, UserRound } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { DropdownPanel } from '@/components/ui/DropdownPanel'
import { WorkspaceMember } from '@/types/workspace'

const AVATAR_CLASS = 'h-[22px] w-[22px] shrink-0 text-[9px]'

// The assignee's avatar, or a dashed placeholder while unassigned.
function AssigneeAvatar({ member }: { member?: WorkspaceMember }) {
  if (!member) {
    return (
      <span
        className={`grid place-items-center rounded-full border border-dashed border-line text-muted ${AVATAR_CLASS}`}
      >
        <UserRound size={12} />
      </span>
    )
  }
  return <Avatar person={member} className={AVATAR_CLASS} />
}

// Compact avatar-pill assignee control — replaces a full-width native
// <select> that spelled the assignee's name out in a box roughly as wide as
// the card itself. Click opens a small popover of avatar + name rows, same
// visual language as the workspace header's member chips/account menu.
export function AssigneePicker({
  assignee,
  members,
  onReassign,
  canUnassign = true,
}: {
  assignee: WorkspaceMember | undefined
  members: WorkspaceMember[]
  onReassign: (userId: string | null) => void
  // False hides "Unassigned" — for a task whose blocker needs an assignee.
  canUnassign?: boolean
}) {
  const [open, setOpen] = useState(false)
  const label = assignee
    ? (assignee.fullName || assignee.email || 'Member').split(' ')[0]
    : 'Unassigned'

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(current => !current)}
        aria-label="Change assignee"
        title={
          assignee ? assignee.fullName || assignee.email || '' : 'Unassigned'
        }
        className="flex items-center gap-1.5 rounded-full border border-line bg-white/70 py-1 pl-1 pr-2 transition hover:border-[var(--ws-accent,#375b4b)]"
      >
        <AssigneeAvatar member={assignee} />
        <span className="max-w-[90px] truncate text-[11px] font-semibold text-ink">
          {label}
        </span>
        <ChevronDown
          size={12}
          className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <DropdownPanel
          onClose={() => setOpen(false)}
          align="left"
          className="w-56 p-1.5"
        >
          {canUnassign && (
            <button
              onClick={() => {
                onReassign(null)
                setOpen(false)
              }}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition hover:bg-slate-100 ${!assignee ? 'text-[var(--ws-accent,#375b4b)]' : 'text-ink'}`}
            >
              <AssigneeAvatar />
              Unassigned
            </button>
          )}
          {members.map(member => (
            <button
              key={member.userId}
              onClick={() => {
                onReassign(member.userId)
                setOpen(false)
              }}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition hover:bg-slate-100 ${assignee?.userId === member.userId ? 'text-[var(--ws-accent,#375b4b)]' : 'text-ink'}`}
            >
              <AssigneeAvatar member={member} />
              <span className="truncate">
                {member.fullName || member.email || 'Member'}
              </span>
            </button>
          ))}
        </DropdownPanel>
      )}
    </div>
  )
}
