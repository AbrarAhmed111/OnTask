import { describe, expect, it } from 'vitest'
import {
  isSheetViewport,
  padRect,
  pickScrollBehavior,
  planScroll,
  placePopover,
  POPOVER_WIDTH,
  Rect,
  VIEWPORT_MARGIN,
} from '@/lib/tour/geometry'

const rect = (top: number, left: number, width: number, height: number) => ({
  top,
  left,
  width,
  height,
})

describe('padRect', () => {
  it('grows the box evenly on every side', () => {
    expect(padRect(rect(100, 50, 200, 80), 6)).toEqual(rect(94, 44, 212, 92))
  })
})

describe('planScroll', () => {
  // 800px viewport, 80px sticky header, no bottom inset: with the 12px gap the
  // visible region runs from y=92 to y=788.
  const insets = { top: 80, bottom: 0 }
  const plan = (target: Rect, extra = insets) => planScroll(target, 800, extra)

  it('leaves a target that is comfortably on screen alone', () => {
    expect(plan(rect(200, 0, 400, 100))).toBe('none')
  })

  it('centres a target below the viewport', () => {
    expect(plan(rect(900, 0, 400, 100))).toBe('center')
  })

  it('centres a target above the viewport', () => {
    expect(plan(rect(-300, 0, 400, 100))).toBe('center')
  })

  it('does not accept a target hidden behind the sticky header', () => {
    expect(plan(rect(50, 0, 400, 100))).toBe('center')
  })

  it('does not accept a target clipped by the bottom edge', () => {
    expect(plan(rect(750, 0, 400, 100))).toBe('center')
  })

  it('counts the space taken by a bottom sheet as unavailable', () => {
    const target = rect(500, 0, 400, 100)
    expect(plan(target)).toBe('none')
    expect(plan(target, { top: 80, bottom: 200 })).toBe('center')
  })

  it('lines a target taller than the visible area up under the header', () => {
    expect(plan(rect(400, 0, 400, 900))).toBe('start')
    expect(plan(rect(-500, 0, 400, 900))).toBe('start')
  })

  it('leaves a tall target that is already lined up', () => {
    expect(plan(rect(92, 0, 400, 900))).toBe('none')
    expect(plan(rect(110, 0, 400, 900))).toBe('none')
    expect(plan(rect(130, 0, 400, 900))).toBe('start')
  })

  it('does nothing when there is no visible area to aim for', () => {
    expect(planScroll(rect(900, 0, 10, 10), 100, { top: 80, bottom: 80 })).toBe(
      'none',
    )
  })
})

describe('pickScrollBehavior', () => {
  it('scrolls smoothly over a short distance', () => {
    expect(pickScrollBehavior(500, 800, false)).toBe('smooth')
  })

  it('jumps rather than sweeping across a long page', () => {
    expect(pickScrollBehavior(3000, 800, false)).toBe('auto')
  })

  it('never animates for a reader who asked for less motion', () => {
    expect(pickScrollBehavior(10, 800, true)).toBe('auto')
  })
})

describe('placePopover', () => {
  const viewport = { width: 1280, height: 800 }
  const popover = { width: POPOVER_WIDTH, height: 180 }
  const place = (target: Rect, prefer?: 'right') =>
    placePopover({ target, viewport, popover, prefer })

  it('goes below the target when there is room', () => {
    const position = place(rect(100, 100, 200, 100))
    expect(position.placement).toBe('bottom')
    expect(position.top).toBe(214)
    // Centred on the target, pointing up at it.
    expect(position.left).toBe(30)
    expect(position.arrow).toEqual({ side: 'top', offset: 170 })
  })

  it('flips above a target near the bottom of the viewport', () => {
    const position = place(rect(600, 500, 200, 150))
    expect(position.placement).toBe('top')
    expect(position.top).toBe(600 - 14 - 180)
    expect(position.arrow?.side).toBe('bottom')
  })

  it('tries the preferred side first', () => {
    const position = place(rect(100, 8, 52, 44), 'right')
    expect(position.placement).toBe('right')
    expect(position.left).toBe(8 + 52 + 14)
    expect(position.arrow?.side).toBe('left')
  })

  it('ignores a preferred side that has no room', () => {
    const position = place(rect(100, 1200, 60, 40), 'right')
    expect(position.placement).not.toBe('right')
  })

  it('keeps the popover inside the viewport beside a target at the far edge', () => {
    const position = place(rect(100, 1200, 60, 40))
    expect(position.left + POPOVER_WIDTH).toBeLessThanOrEqual(
      viewport.width - VIEWPORT_MARGIN,
    )
    // The arrow still points at the target, not at the clamped centre.
    expect(position.arrow?.offset).toBe(1230 - position.left)
  })

  it('floats over a target too large to sit beside', () => {
    const position = place(rect(60, 20, 1240, 720))
    expect(position.placement).toBe('overlay')
    expect(position.arrow).toBeUndefined()
    // One margin inside the target's lower edge (780).
    expect(position.top).toBe(780 - 180 - VIEWPORT_MARGIN)
  })

  it('sits above a target that runs past the bottom, if there is room up there', () => {
    const position = place(rect(400, 100, 600, 900))
    expect(position.placement).toBe('top')
    expect(position.top + 180).toBeLessThanOrEqual(400 - 14)
  })

  it('stays on screen for a target that runs past the bottom with no room above', () => {
    const position = place(rect(60, 20, 1240, 1200))
    expect(position.placement).toBe('overlay')
    // The target's lower edge is off screen, so the *viewport's* is used:
    // a margin above the bottom margin, not below the fold.
    expect(position.top).toBe(
      viewport.height - VIEWPORT_MARGIN - 180 - VIEWPORT_MARGIN,
    )
  })

  it('pins to the bottom edge on a phone, without an arrow', () => {
    const position = placePopover({
      target: rect(100, 20, 300, 100),
      viewport: { width: 390, height: 800 },
      popover: { width: 366, height: 200 },
    })
    expect(position.placement).toBe('sheet')
    expect(position.top).toBe(800 - VIEWPORT_MARGIN - 200)
    expect(position.left).toBe(VIEWPORT_MARGIN)
    expect(position.arrow).toBeUndefined()
  })

  it('never leaves the viewport, and never covers a target it sits beside', () => {
    const targets: Rect[] = []
    for (const top of [-50, 0, 90, 300, 620, 760]) {
      for (const left of [0, 8, 300, 900, 1250]) {
        for (const [width, height] of [
          [40, 40],
          [300, 120],
          [1200, 700],
        ]) {
          targets.push(rect(top, left, width, height))
        }
      }
    }
    for (const target of targets) {
      for (const size of [
        { width: POPOVER_WIDTH, height: 150 },
        { width: POPOVER_WIDTH, height: 260 },
      ]) {
        const position = placePopover({ target, viewport, popover: size })
        const label = JSON.stringify({ target, size, position })
        expect(position.left, label).toBeGreaterThanOrEqual(VIEWPORT_MARGIN)
        expect(position.top, label).toBeGreaterThanOrEqual(VIEWPORT_MARGIN)
        expect(position.left + size.width, label).toBeLessThanOrEqual(
          viewport.width - VIEWPORT_MARGIN,
        )
        expect(position.top + size.height, label).toBeLessThanOrEqual(
          viewport.height - VIEWPORT_MARGIN,
        )
        if (position.placement !== 'overlay') {
          const overlaps =
            position.left < target.left + target.width &&
            position.left + size.width > target.left &&
            position.top < target.top + target.height &&
            position.top + size.height > target.top
          expect(overlaps, label).toBe(false)
        }
      }
    }
  })
})

describe('isSheetViewport', () => {
  it('switches to the phone layout below the sm breakpoint', () => {
    expect(isSheetViewport(639)).toBe(true)
    expect(isSheetViewport(640)).toBe(false)
  })
})
