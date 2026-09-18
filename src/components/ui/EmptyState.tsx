import { ComponentType, ReactNode } from 'react'

const PADDING = { sm: 'py-8', md: 'py-10', lg: 'py-14' }

// The dashed "nothing here yet" placeholder used by every list-like section
// (tasks, goals, resources, a goal's task list, the resources modal). A bare
// message is a one-line note; with a `title` the message becomes a smaller
// description beneath it, optionally with an icon above and an action below.
//
// Deliberately not used by the guest dashboard's first-run prompt
// (components/dashboard/FirstTaskPrompt) — that is a full-width landing CTA,
// not a section placeholder.
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  size = 'md',
  className = '',
}: {
  icon?: ComponentType<{ size?: number; className?: string }>
  title?: string
  children?: ReactNode
  action?: ReactNode
  size?: keyof typeof PADDING
  className?: string
}) {
  return (
    <div
      className={`rounded-2xl border border-dashed border-sage/70 px-5 text-center ${PADDING[size]} ${className}`}
    >
      {Icon && <Icon size={22} className="mx-auto text-sage" />}
      {title && (
        <p className={`text-xs font-semibold text-ink ${Icon ? 'mt-3' : ''}`}>
          {title}
        </p>
      )}
      {children &&
        (title ? (
          <p className="mx-auto mt-1 max-w-xs text-[11px] leading-5 text-muted">
            {children}
          </p>
        ) : (
          <p className="text-xs text-muted">{children}</p>
        ))}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}
