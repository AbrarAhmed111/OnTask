import { Avatar } from '@/components/ui/Avatar'
import { mentionLabel } from '@/lib/mentions'
import type { WorkspaceMember } from '@/types/workspace'

export const mentionOptionId = (listId: string, index: number) =>
  `${listId}-option-${index}`

// The list of workspace members offered while someone types "@name". It only
// renders what it is given — filtering, and which row is highlighted, belong to
// the field that owns the text (MentionTextarea) — so anything else that needs
// to pick a member by typing can put the same list under its own input.
//
// Rows are keyed by userId, and each shows the email under the name: two
// members can share a display name, and the email is what tells them apart.
// Options are never focusable (the input keeps focus and points at the active
// one with aria-activedescendant); a mouse press is swallowed so the field
// doesn't blur before the choice lands.
export function MemberMentionPicker({
  id,
  members,
  activeIndex,
  onSelect,
  onHover,
}: {
  // Also the id the input's aria-controls names.
  id: string
  members: readonly WorkspaceMember[]
  activeIndex: number
  onSelect: (member: WorkspaceMember) => void
  onHover?: (index: number) => void
}) {
  return (
    <ul
      id={id}
      role="listbox"
      aria-label="Workspace members"
      className="absolute left-0 right-0 z-50 mt-1 max-h-56 overflow-y-auto rounded-xl border border-line bg-panel p-1.5 shadow-xl animate-[fadeIn_120ms_ease-out]"
    >
      {members.map((member, index) => {
        const active = index === activeIndex
        return (
          <li
            key={member.userId}
            id={mentionOptionId(id, index)}
            role="option"
            aria-selected={active}
            onMouseDown={event => {
              event.preventDefault()
              onSelect(member)
            }}
            onMouseEnter={() => onHover?.(index)}
            className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 ${active ? 'bg-slate-100' : ''}`}
          >
            <Avatar person={member} className="h-6 w-6 shrink-0 text-[10px]" />
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold text-ink">
                {mentionLabel(member)}
              </span>
              {member.email && member.fullName?.trim() && (
                <span className="block truncate text-[10px] text-muted">
                  {member.email}
                </span>
              )}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
