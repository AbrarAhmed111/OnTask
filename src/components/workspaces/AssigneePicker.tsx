'use client'

import { useState } from 'react'
import { ChevronDown, UserRound } from 'lucide-react'
import { WorkspaceMember } from '@/types/workspace'

function Avatar({
  member,
  size = 22,
}: {
  member?: WorkspaceMember
  size?: number
}) {
  if (!member) {
    return (
      <span
        style={{ height: size, width: size }}
        className="grid shrink-0 place-items-center rounded-full border border-dashed border-line text-muted"
      >
        <UserRound size={size * 0.55} />
      </span>
    )
  }
  return (
    <span
      style={{ height: size, width: size }}
      className="grid shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--ws-accent,#375b4b)] text-[9px] font-bold text-white"
    >
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
    </span>
  )
}

// Compact avatar-pill assignee control — replaces a full-width native
// <select> that spelled the assignee's name out in a box roughly as wide as
// the card itself. Click opens a small popover of avatar + name rows, same
// visual language as the workspace header's member chips/account menu.
export function AssigneePicker({
  assignee,
  members,
  onReassign,
}: {
  assignee: WorkspaceMember | undefined
  members: WorkspaceMember[]
  onReassign: (userId: string | null) => void
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
        <Avatar member={assignee} />
        <span className="max-w-[90px] truncate text-[11px] font-semibold text-ink">
          {label}
        </span>
        <ChevronDown
          size={12}
          className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <>
          <button
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 z-50 mt-2 w-56 rounded-xl border border-line bg-panel p-1.5 shadow-xl animate-[fadeIn_150ms_ease-out]">
            <button
              onClick={() => {
                onReassign(null)
                setOpen(false)
              }}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition hover:bg-slate-100 ${!assignee ? 'text-[var(--ws-accent,#375b4b)]' : 'text-ink'}`}
            >
              <Avatar />
              Unassigned
            </button>
            {members.map(member => (
              <button
                key={member.userId}
                onClick={() => {
                  onReassign(member.userId)
                  setOpen(false)
                }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition hover:bg-slate-100 ${assignee?.userId === member.userId ? 'text-[var(--ws-accent,#375b4b)]' : 'text-ink'}`}
              >
                <Avatar member={member} />
                <span className="truncate">
                  {member.fullName || member.email || 'Member'}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
