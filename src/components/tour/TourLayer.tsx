'use client'

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { usePortalTheme } from '@/components/ui/PortalTheme'
import { TourHighlight } from '@/components/tour/TourHighlight'
import { TourPopover } from '@/components/tour/TourPopover'
import { useTour } from '@/components/tour/TourProvider'
import { useTourTarget } from '@/components/tour/useTourTarget'
import { lockBodyScroll } from '@/lib/scrollLock'
import {
  isSheetViewport,
  padRect,
  placePopover,
  PopoverPosition,
  POPOVER_WIDTH,
  Size,
  SPOTLIGHT_PADDING,
  VIEWPORT_MARGIN,
} from '@/lib/tour/geometry'
import type { TourRun } from '@/lib/tour/types'

const readViewport = (): Size => ({
  width: document.documentElement.clientWidth,
  height: window.innerHeight,
})

const AUTO_ADVANCE_MS = 6000

// Draws the running tour, if there is one. Render it inside the workspace
// shell: it portals to <body> so nothing can sit above it, and the portal
// carries the shell's accent variables with it (see ui/PortalTheme).
export function TourLayer() {
  const { run } = useTour()
  if (!run || typeof document === 'undefined') return null
  return createPortal(<ActiveTour run={run} />, document.body)
}

// Layers, bottom to top, all above every layer the app has (header z-30,
// dropdowns z-40/50, modals z-50):
//   z-60  a transparent sheet that swallows clicks, so a stray click can't
//         navigate away or start something mid-tour
//   z-61  the highlight: dark backdrop with the target cut out (TourHighlight)
//   z-62  the popover
function ActiveTour({ run }: { run: TourRun }) {
  const { next, back, skip, dropStep } = useTour()
  const theme = usePortalTheme()
  const step = run.steps[run.index]
  const stepKey = `${run.tourId}:${run.index}:${step.target}`

  const popoverRef = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState<Size>(readViewport)
  const [popoverSize, setPopoverSize] = useState<Size>({
    width: POPOVER_WIDTH,
    height: 0,
  })
  const sheet = isSheetViewport(viewport.width)

  // On a phone the popover is a sheet along the bottom edge, so a target must
  // be scrolled to above it, not under it.
  const getBottomInset = useCallback(
    () =>
      sheet ? (popoverRef.current?.offsetHeight ?? 0) + VIEWPORT_MARGIN : 0,
    [sheet],
  )

  // The page underneath doesn't scroll for the user while the tour is open --
  // it scrolls only when the tour moves it -- and focus goes back to where it
  // was when the tour ends. Declared before the target hook on purpose: effects
  // run in order, and the lock (which changes `overflow` and compensates for
  // the scrollbar) must be in place before the first scroll starts, not land in
  // the middle of it.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const release = lockBodyScroll()
    return () => {
      release()
      if (
        previouslyFocused &&
        previouslyFocused !== document.body &&
        document.body.contains(previouslyFocused)
      ) {
        previouslyFocused.focus({ preventScroll: true })
      }
    }
  }, [])

  const target = useTourTarget({
    anchor: step.target,
    stepKey,
    getBottomInset,
    onMissing: dropStep,
  })

  useEffect(() => {
    if (!target.ready) return
    const timer = window.setTimeout(next, AUTO_ADVANCE_MS)
    return () => window.clearTimeout(timer)
  }, [next, stepKey, target.ready])

  useEffect(() => {
    const update = () =>
      setViewport(current => {
        const latest = readViewport()
        return current.width === latest.width &&
          current.height === latest.height
          ? current
          : latest
      })
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // The popover's size decides where it can go, and it changes with the step's
  // copy and with the layout (a phone gets a full-width sheet), so measure it
  // before paint whenever either changes -- and keep watching.
  useLayoutEffect(() => {
    const element = popoverRef.current
    if (!element) return
    const measure = () =>
      setPopoverSize(current =>
        current.width === element.offsetWidth &&
        current.height === element.offsetHeight
          ? current
          : { width: element.offsetWidth, height: element.offsetHeight },
      )
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [stepKey, sheet])

  // Escape always gets out. Left/Right step through, but only when focus is on
  // the popover or nowhere in particular, so it never steals arrow keys from a
  // field in the app behind. Tab is left alone: the tour never traps focus.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      if (event.key === 'Escape') {
        event.preventDefault()
        skip()
        return
      }
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
      const active = document.activeElement
      const inPopover = popoverRef.current?.contains(active) ?? false
      if (!inPopover && active !== document.body) return
      event.preventDefault()
      if (event.key === 'ArrowRight') next()
      else back()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [next, back, skip])

  // Once a step is showing, put focus on its primary button so the keyboard
  // continues from the guidance -- unless focus is already inside it (the user
  // just pressed Back or Next there).
  useEffect(() => {
    if (!target.ready) return
    const popover = popoverRef.current
    if (!popover || popover.contains(document.activeElement)) return
    popover
      .querySelector<HTMLElement>('[data-tour-primary]')
      ?.focus({ preventScroll: true })
  }, [target.ready, stepKey])

  const highlight = target.rect ? padRect(target.rect, SPOTLIGHT_PADDING) : null
  const position: PopoverPosition = highlight
    ? placePopover({
        target: highlight,
        viewport,
        popover: popoverSize,
        prefer: step.prefer,
      })
    : { placement: sheet ? 'sheet' : 'overlay', top: 0, left: 0 }

  return (
    <div style={theme}>
      <div aria-hidden className="fixed inset-0 z-[60] touch-none" />
      <TourHighlight
        rect={highlight}
        radius={target.radius + SPOTLIGHT_PADDING}
        glide={target.glide}
      />
      <TourPopover
        ref={popoverRef}
        title={step.title}
        description={step.description}
        hint={step.hint}
        stepNumber={run.index + 1}
        stepCount={run.steps.length}
        visible={target.ready}
        position={position}
        onNext={next}
        onBack={back}
        onSkip={skip}
      />
      {/* The dialog is where the guidance is read; this is what tells a screen
          reader the step changed while focus stays on the same button. */}
      <div role="status" aria-live="polite" className="sr-only">
        {target.ready
          ? `Step ${run.index + 1} of ${run.steps.length}: ${step.title}. ${step.description}`
          : ''}
      </div>
    </div>
  )
}
