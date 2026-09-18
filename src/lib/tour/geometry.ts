import type { Placement } from '@/lib/tour/types'

// Layout maths for a tour, kept free of the DOM so it can be tested. Every
// rectangle is in viewport coordinates (what getBoundingClientRect returns).

export type Rect = { top: number; left: number; width: number; height: number }
export type Size = { width: number; height: number }
// Space at the top/bottom of the viewport that something else already
// occupies (the sticky header; on a phone, the guidance sheet).
export type Insets = { top: number; bottom: number }

// Breathing room the highlight leaves around its target.
export const SPOTLIGHT_PADDING = 6
// Minimum distance from the popover, or a scrolled target, to a viewport edge.
export const VIEWPORT_MARGIN = 12
// Distance between the highlight and the popover beside it.
export const POPOVER_GAP = 14
export const POPOVER_WIDTH = 340
// Below this width the popover becomes a card pinned to the bottom edge.
export const SHEET_BREAKPOINT = 640
// How far the arrow keeps from a popover corner.
const ARROW_INSET = 20
// A tall target already lined up this close to the top needs no nudging.
const TOP_ALIGN_TOLERANCE = 24

export function padRect(rect: Rect, padding: number): Rect {
  return {
    top: rect.top - padding,
    left: rect.left - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  }
}

export function isSheetViewport(viewportWidth: number) {
  return viewportWidth < SHEET_BREAKPOINT
}

// ── scrolling ───────────────────────────────────────────────────────────────

// 'none'   already comfortably on screen -- don't move the page;
// 'center' bring it to the middle of the space that is actually visible;
// 'start'  it is taller than that space, so line its top edge up just under
//          the header instead of centring it (which would cut off both ends).
export type ScrollPlan = 'none' | 'center' | 'start'

export function planScroll(
  rect: Rect,
  viewportHeight: number,
  insets: Insets,
  gap = VIEWPORT_MARGIN,
): ScrollPlan {
  const regionTop = insets.top + gap
  const regionBottom = viewportHeight - insets.bottom - gap
  const regionHeight = regionBottom - regionTop
  if (regionHeight <= 0) return 'none'

  if (rect.height > regionHeight) {
    return Math.abs(rect.top - regionTop) <= TOP_ALIGN_TOLERANCE
      ? 'none'
      : 'start'
  }
  const fits = rect.top >= regionTop && rect.top + rect.height <= regionBottom
  return fits ? 'none' : 'center'
}

// Smooth scrolling is calm over a short distance and nauseating over a long
// one, so a far jump (or a reader who asked for less motion) is instant.
export function pickScrollBehavior(
  distance: number,
  viewportHeight: number,
  reducedMotion: boolean,
): 'smooth' | 'auto' {
  if (reducedMotion) return 'auto'
  return distance > viewportHeight * 2.5 ? 'auto' : 'smooth'
}

// ── popover placement ───────────────────────────────────────────────────────

export type ArrowSide = 'top' | 'bottom' | 'left' | 'right'

export type PopoverPosition = {
  // 'sheet' is the phone layout: pinned to the bottom edge, no arrow.
  // 'overlay' is the fallback for a target too big to sit beside: the popover
  // floats over its lower part rather than leaving the viewport.
  placement: Placement | 'overlay' | 'sheet'
  top: number
  left: number
  // Which popover edge carries the arrow and how far along it, in px.
  arrow?: { side: ArrowSide; offset: number }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

// Where to put a popover of `popover` size next to `target` (the highlight,
// padding included) so that it stays inside the viewport, doesn't cover the
// target, and points at it. Tries `prefer` first, then bottom, top, right,
// left; when no side has room it overlays the target's lower part.
export function placePopover({
  target,
  viewport,
  popover,
  prefer,
  gap = POPOVER_GAP,
  margin = VIEWPORT_MARGIN,
}: {
  target: Rect
  viewport: Size
  popover: Size
  prefer?: Placement
  gap?: number
  margin?: number
}): PopoverPosition {
  if (isSheetViewport(viewport.width)) {
    return {
      placement: 'sheet',
      top: viewport.height - margin - popover.height,
      left: margin,
    }
  }

  const targetRight = target.left + target.width
  const targetBottom = target.top + target.height
  const centerX = target.left + target.width / 2
  const centerY = target.top + target.height / 2
  const maxLeft = viewport.width - margin - popover.width
  const maxTop = viewport.height - margin - popover.height

  const room: Record<Placement, number> = {
    bottom: viewport.height - targetBottom - gap - margin,
    top: target.top - gap - margin,
    right: viewport.width - targetRight - gap - margin,
    left: target.left - gap - margin,
  }
  const needed: Record<Placement, number> = {
    bottom: popover.height,
    top: popover.height,
    right: popover.width,
    left: popover.width,
  }
  const order: Placement[] = ['bottom', 'top', 'right', 'left']
  if (prefer) order.unshift(prefer)
  const placement = order.find(side => room[side] >= needed[side])

  switch (placement) {
    case 'bottom':
    case 'top': {
      const left = clamp(centerX - popover.width / 2, margin, maxLeft)
      // The room check already guarantees the side fits; clamping the main
      // axis as well only matters for a target that is itself off screen.
      return {
        placement,
        top: clamp(
          placement === 'bottom'
            ? targetBottom + gap
            : target.top - gap - popover.height,
          margin,
          maxTop,
        ),
        left,
        arrow: {
          side: placement === 'bottom' ? 'top' : 'bottom',
          offset: clamp(
            centerX - left,
            ARROW_INSET,
            popover.width - ARROW_INSET,
          ),
        },
      }
    }
    case 'right':
    case 'left': {
      const top = clamp(centerY - popover.height / 2, margin, maxTop)
      return {
        placement,
        top,
        left: clamp(
          placement === 'right'
            ? targetRight + gap
            : target.left - gap - popover.width,
          margin,
          maxLeft,
        ),
        arrow: {
          side: placement === 'right' ? 'left' : 'right',
          offset: clamp(
            centerY - top,
            ARROW_INSET,
            popover.height - ARROW_INSET,
          ),
        },
      }
    }
    default:
      return {
        placement: 'overlay',
        top: clamp(
          Math.min(targetBottom, viewport.height - margin) -
            popover.height -
            margin,
          margin,
          maxTop,
        ),
        left: clamp(centerX - popover.width / 2, margin, maxLeft),
      }
  }
}
