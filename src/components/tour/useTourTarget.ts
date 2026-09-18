'use client'

import { useEffect, useRef, useState } from 'react'
import type { TourAnchor } from '@/lib/tourAnchors'
import {
  pickScrollBehavior,
  planScroll,
  Rect,
  VIEWPORT_MARGIN,
} from '@/lib/tour/geometry'
import {
  isInsideChrome,
  measureInsets,
  prefersReducedMotion,
  resolveTourTarget,
  targetRadius,
  toRect,
} from '@/lib/tour/target'

// The target counts as arrived once its box has held still this many frames
// (about a tenth of a second) -- that is what "scrolling has finished" looks
// like without depending on `scrollend`, which Safari lacks.
const STABLE_FRAMES = 6
// ...but never wait longer than this for something that keeps moving.
const MAX_SETTLE_MS = 1500
// A smooth scroll can take a frame or two to get going, and until it does the
// target looks perfectly still. A step that scrolls therefore waits at least
// this long before it may count as arrived.
const MIN_SCROLL_SETTLE_MS = 150

export type TourTarget = {
  // Where the target is right now, in viewport coordinates.
  rect: Rect | null
  radius: number
  // Scrolled into place and still: the popover may appear.
  ready: boolean
  // Whether the highlight should glide to a new box (a step that needed no
  // scrolling) rather than track the target frame by frame (a page that is
  // scrolling under it).
  glide: boolean
}

type Tracked = TourTarget & { key: string }

// Finds a step's target, brings it into view if it isn't, then follows it.
//
// Following it every frame -- instead of measuring once, or on scroll/resize
// events -- is what keeps the highlight glued to the target through smooth
// scrolling, window resizes, content that finishes loading, and layout shifts,
// with no per-cause bookkeeping. Only a change of box causes a render.
export function useTourTarget({
  anchor,
  stepKey,
  getBottomInset,
  onMissing,
}: {
  anchor: TourAnchor
  // Changes whenever the step does, even if two steps share an anchor.
  stepKey: string
  // Space at the bottom of the viewport the guidance itself takes up (the
  // phone layout's sheet), so a target isn't scrolled to underneath it.
  getBottomInset: () => number
  // The anchor isn't on screen (any more).
  onMissing: () => void
}): TourTarget {
  const [tracked, setTracked] = useState<Tracked>({
    key: '',
    rect: null,
    radius: 0,
    ready: false,
    glide: false,
  })

  const getBottomInsetRef = useRef(getBottomInset)
  const onMissingRef = useRef(onMissing)
  useEffect(() => {
    getBottomInsetRef.current = getBottomInset
    onMissingRef.current = onMissing
  })

  useEffect(() => {
    let element = resolveTourTarget(anchor)
    if (!element) {
      onMissingRef.current()
      return
    }

    let cancelled = false
    let frame = 0

    const initial = toRect(element.getBoundingClientRect())
    const insets = { ...measureInsets(), bottom: getBottomInsetRef.current() }
    const plan = isInsideChrome(element)
      ? 'none'
      : planScroll(initial, window.innerHeight, insets)

    setTracked({
      key: stepKey,
      rect: initial,
      radius: targetRadius(element),
      ready: false,
      // Only a step that leaves the page where it is glides; one that scrolls
      // must follow the target as it travels.
      glide: plan === 'none',
    })

    if (plan !== 'none') {
      const distance = Math.abs(initial.top - (insets.top + VIEWPORT_MARGIN))
      const previousTop = element.style.scrollMarginTop
      const previousBottom = element.style.scrollMarginBottom
      // scroll-margin makes the browser treat the sticky header (and, on a
      // phone, the sheet) as if it were part of the target's own box, so the
      // target lands in the space that is actually visible. The browser reads
      // it when scrolling starts, so it can be put back straight away.
      element.style.scrollMarginTop = `${insets.top + VIEWPORT_MARGIN}px`
      element.style.scrollMarginBottom = `${insets.bottom + VIEWPORT_MARGIN}px`
      element.scrollIntoView({
        block: plan === 'start' ? 'start' : 'center',
        inline: 'nearest',
        behavior: pickScrollBehavior(
          distance,
          window.innerHeight,
          prefersReducedMotion(),
        ),
      })
      element.style.scrollMarginTop = previousTop
      element.style.scrollMarginBottom = previousBottom
    }

    let lastBox = ''
    let stableFrames = 0
    let ready = false
    const startedAt = performance.now()

    const tick = (now: number) => {
      if (cancelled || !element) return

      let rect = toRect(element.getBoundingClientRect())
      if (!element.isConnected || rect.width === 0 || rect.height === 0) {
        // The element was swapped for a new one by a re-render, or hidden.
        const replacement = resolveTourTarget(anchor)
        if (!replacement) {
          onMissingRef.current()
          return
        }
        element = replacement
        rect = toRect(element.getBoundingClientRect())
        const radius = targetRadius(element)
        setTracked(current => ({ ...current, radius }))
      }

      const box = [rect.top, rect.left, rect.width, rect.height]
        .map(Math.round)
        .join(',')
      if (box !== lastBox) {
        lastBox = box
        stableFrames = 0
        setTracked(current => ({ ...current, rect }))
      } else {
        stableFrames += 1
      }

      const elapsed = now - startedAt
      const settled =
        stableFrames >= STABLE_FRAMES &&
        (plan === 'none' || elapsed >= MIN_SCROLL_SETTLE_MS)
      if (!ready && (settled || elapsed > MAX_SETTLE_MS)) {
        ready = true
        setTracked(current => ({ ...current, ready: true, glide: true }))
      }

      frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)

    return () => {
      cancelled = true
      window.cancelAnimationFrame(frame)
    }
  }, [anchor, stepKey])

  // State left over from the previous step must not look like this step's:
  // for the one render between the step changing and the effect above running,
  // the new step is not yet ready.
  return {
    rect: tracked.rect,
    radius: tracked.radius,
    ready: tracked.ready && tracked.key === stepKey,
    glide: tracked.glide,
  }
}
