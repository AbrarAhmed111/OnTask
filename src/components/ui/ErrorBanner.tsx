import { ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

const VARIANTS = {
  // A standalone notice.
  boxed: 'rounded-xl border border-coral/20 bg-coral/5 p-3',
  // Full-width strip directly under a card's header row.
  flush: 'border-b border-line/70 px-5 py-3',
  // The only content of a card body, whose header above already has a rule.
  plain: 'px-5 py-4',
}

// The one inline error notice. Every section, modal and form used to carry
// its own copy of this markup; they all render it from here now so an error
// looks (and is announced) the same wherever it appears.
export function ErrorBanner({
  children,
  variant = 'boxed',
  className = '',
}: {
  children: ReactNode
  variant?: keyof typeof VARIANTS
  className?: string
}) {
  return (
    <div
      role="alert"
      className={`flex items-start gap-2 text-xs leading-5 text-coral ${VARIANTS[variant]} ${className}`}
    >
      <AlertTriangle size={15} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  )
}
