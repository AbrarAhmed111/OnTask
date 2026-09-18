import { ReactNode } from 'react'

// The floating panel under a trigger, plus the invisible full-screen layer
// behind it that closes it on an outside click. Render it as a sibling of the
// trigger inside a `relative` wrapper. Size and padding come from the caller
// (an account menu is w-52, an assignee list w-56).
export function DropdownPanel({
  onClose,
  align = 'right',
  className = '',
  children,
}: {
  onClose: () => void
  align?: 'left' | 'right'
  className?: string
  children: ReactNode
}) {
  return (
    <>
      <button
        aria-hidden
        tabIndex={-1}
        className="fixed inset-0 z-40 cursor-default"
        onClick={onClose}
      />
      <div
        className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} z-50 mt-2 rounded-xl border border-line bg-panel shadow-xl animate-[fadeIn_150ms_ease-out] ${className}`}
      >
        {children}
      </div>
    </>
  )
}
