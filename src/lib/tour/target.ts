import type { TourAnchor } from '@/lib/tourAnchors'
import type { Insets, Rect } from '@/lib/tour/geometry'

// The DOM side of a tour: finding what a step points at and measuring it.
// Anything that can be decided without a DOM is in geometry.ts / navigation.ts.

export function toRect(rect: DOMRect): Rect {
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  }
}

// On screen, not merely in the document: display:none (on the element or any
// ancestor) leaves no client rects, and a zero-size or visibility:hidden box
// has nothing to highlight.
export function isRendered(element: Element): boolean {
  if (!element.isConnected) return false
  if (element.getClientRects().length === 0) return false
  const box = element.getBoundingClientRect()
  if (box.width === 0 || box.height === 0) return false
  return window.getComputedStyle(element).visibility !== 'hidden'
}

// The first *visible* element carrying the anchor. The same anchor can sit on
// several elements when one thing is rendered responsively (the settings entry
// is a sidebar icon from `sm:` up and a tab below it) and only one of them is
// ever displayed, so the first match in the document is not necessarily the
// one to point at.
export function resolveTourTarget(anchor: TourAnchor): HTMLElement | null {
  const candidates = document.querySelectorAll<HTMLElement>(
    `[data-tour="${anchor}"]`,
  )
  for (const candidate of candidates) {
    if (isRendered(candidate)) return candidate
  }
  return null
}

// The target's own corner radius, so the highlight follows the shape of what
// it frames (a rounded card gets rounded corners, a square block doesn't).
export function targetRadius(element: Element): number {
  const value = window.getComputedStyle(element).borderTopLeftRadius
  const radius = Number.parseFloat(value)
  return Number.isFinite(radius) ? radius : 0
}

// How much of the top of the viewport sticky chrome is covering right now.
export function measureInsets(): Insets {
  let top = 0
  document
    .querySelectorAll<HTMLElement>('[data-tour-inset="top"]')
    .forEach(element => {
      if (!isRendered(element)) return
      top = Math.max(top, element.getBoundingClientRect().bottom)
    })
  return { top: Math.max(0, top), bottom: 0 }
}

// A target inside sticky chrome is always on screen; scrolling the page to
// "reveal" it would only move the content behind it.
export function isInsideChrome(element: Element): boolean {
  return element.closest('[data-tour-inset]') !== null
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}
