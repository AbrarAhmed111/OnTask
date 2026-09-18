// Anyone with a name/email/photo — a workspace member or the signed-in user.
type AvatarPerson = {
  fullName?: string | null
  email?: string | null
  avatarUrl?: string | null
}

// A person's photo, or their initial on the workspace accent when they have
// none. The caller supplies size, border and text size via `className` (an
// avatar is used from 20px in a task's assignee stack to 36px in the member
// list); this owns only what never varies.
export function Avatar({
  person,
  className = '',
  title,
}: {
  person: AvatarPerson
  className?: string
  title?: string
}) {
  return (
    <span
      title={title}
      className={`grid place-items-center overflow-hidden rounded-full bg-[var(--ws-accent,#375b4b)] font-bold text-white ${className}`}
    >
      {person.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={person.avatarUrl}
          alt=""
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
        />
      ) : (
        (person.fullName || person.email || '?').charAt(0).toUpperCase()
      )}
    </span>
  )
}
