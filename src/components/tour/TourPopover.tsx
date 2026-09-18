import { CSSProperties, forwardRef, useId } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import {
  ArrowSide,
  POPOVER_WIDTH,
  PopoverPosition,
  VIEWPORT_MARGIN,
} from '@/lib/tour/geometry'

const ARROW_SIZE = 12

// Which two borders of the rotated square form the point that faces the
// target (the square's outward-facing corner after a 45 degree turn).
const ARROW_CLASSES: Record<ArrowSide, string> = {
  top: 'border-l border-t',
  bottom: 'border-b border-r',
  left: 'border-b border-l',
  right: 'border-r border-t',
}

function arrowStyle(side: ArrowSide, offset: number): CSSProperties {
  const half = ARROW_SIZE / 2
  switch (side) {
    case 'top':
      return { top: -half, left: offset - half }
    case 'bottom':
      return { bottom: -half, left: offset - half }
    case 'left':
      return { left: -half, top: offset - half }
    case 'right':
      return { right: -half, top: offset - half }
  }
}

const FOCUS_RING =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ws-accent,#375b4b)]'

// The guidance card for one step: which step, what it is, what to do there,
// and Back / Next / Skip. Presentational -- the layer decides where it sits and
// when it is visible. It stays mounted while hidden so its size can be measured
// before it is placed.
//
// It is a non-modal dialog on purpose: the app behind it is still reachable
// with the keyboard, and Escape or Skip always gets out.
export const TourPopover = forwardRef<
  HTMLDivElement,
  {
    title: string
    description: string
    hint?: string
    // 1-based, for "Step 2 of 5".
    stepNumber: number
    stepCount: number
    visible: boolean
    position: PopoverPosition
    onNext: () => void
    onBack: () => void
    onSkip: () => void
  }
>(function TourPopover(
  {
    title,
    description,
    hint,
    stepNumber,
    stepCount,
    visible,
    position,
    onNext,
    onBack,
    onSkip,
  },
  ref,
) {
  const titleId = useId()
  const descriptionId = useId()
  const isFirst = stepNumber === 1
  const isLast = stepNumber === stepCount
  const sheet = position.placement === 'sheet'

  // A phone gets a card pinned to the bottom edge (above the home indicator),
  // full width but for a gutter; anything larger is placed beside the target.
  const style: CSSProperties = sheet
    ? {
        left: VIEWPORT_MARGIN,
        right: VIEWPORT_MARGIN,
        bottom: `max(${VIEWPORT_MARGIN}px, env(safe-area-inset-bottom))`,
      }
    : { top: position.top, left: position.left, width: POPOVER_WIDTH }

  return (
    <div
      ref={ref}
      role="dialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      tabIndex={-1}
      style={style}
      className={`fixed z-[62] rounded-2xl border border-line bg-panel p-4 shadow-2xl outline-none transition duration-200 ease-out motion-reduce:transition-none ${
        visible
          ? 'translate-y-0 opacity-100'
          : 'pointer-events-none invisible translate-y-1.5 opacity-0'
      }`}
    >
      {position.arrow && (
        <span
          aria-hidden
          style={{
            ...arrowStyle(position.arrow.side, position.arrow.offset),
            width: ARROW_SIZE,
            height: ARROW_SIZE,
          }}
          className={`absolute rotate-45 border-line bg-panel ${ARROW_CLASSES[position.arrow.side]}`}
        />
      )}

      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-coral">
          Step {stepNumber} of {stepCount}
        </p>
        <button
          type="button"
          aria-label="Close tour"
          onClick={onSkip}
          className={`-mr-1 -mt-1 shrink-0 rounded-lg p-1 text-muted transition hover:bg-slate-100 hover:text-ink ${FOCUS_RING}`}
        >
          <X size={16} />
        </button>
      </div>

      <h2
        id={titleId}
        className="mt-2 text-base font-bold tracking-tight text-ink"
      >
        {title}
      </h2>
      <p id={descriptionId} className="mt-1.5 text-xs leading-5 text-ink/80">
        {description}
      </p>
      {hint && <p className="mt-2 text-[11px] leading-5 text-muted">{hint}</p>}

      <div className="mt-4 flex items-center justify-between gap-3">
        <div aria-hidden className="flex items-center gap-1">
          {Array.from({ length: stepCount }, (_, index) => (
            <span
              key={index}
              className={`h-1.5 rounded-full transition-all duration-200 ${
                index === stepNumber - 1
                  ? 'w-4 bg-[var(--ws-accent,#375b4b)]'
                  : 'w-1.5 bg-slate-200'
              }`}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          {!isFirst && (
            <Button type="button" variant="secondary" onClick={onBack}>
              Back
            </Button>
          )}
          <Button type="button" data-tour-primary onClick={onNext}>
            {isLast ? 'Done' : 'Next'}
          </Button>
        </div>
      </div>

      {!isLast && (
        <button
          type="button"
          onClick={onSkip}
          className={`mt-3 block w-full rounded-lg py-1 text-center text-[11px] font-semibold text-muted transition hover:text-ink ${FOCUS_RING}`}
        >
          Skip tour
        </button>
      )}
    </div>
  )
})
