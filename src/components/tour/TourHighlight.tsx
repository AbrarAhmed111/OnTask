import type { Rect } from '@/lib/tour/geometry'

// The dark backdrop and the target's cut-out are one element: a box laid over
// the target whose enormous box-shadow dims everything around it. The target
// itself is never lifted above the backdrop, so there is no stacking to fight
// -- the sticky header (z-30, its own stacking context), dropdowns and modals
// all simply sit beneath the shadow and the target shows through the hole.
//
// Before there is a target to frame the box collapses to a point, and its
// shadow still covers the whole viewport, so the backdrop is up from the first
// frame and the hole opens when the target is found.
const BACKDROP = '0 0 0 9999px rgba(0, 0, 0, 0.6)'
// A thin light edge so the cut-out reads as a frame, not just an absence.
const RING = '0 0 0 2px rgba(255, 255, 255, 0.9)'

export function TourHighlight({
  rect,
  radius,
  glide,
}: {
  // Includes the padding around the target.
  rect: Rect | null
  radius: number
  glide: boolean
}) {
  const box = rect ?? { top: 0, left: 0, width: 0, height: 0 }
  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed z-[61] animate-[fadeIn_180ms_ease-out] ${
        glide
          ? 'transition-[top,left,width,height,border-radius] duration-200 ease-out motion-reduce:transition-none'
          : ''
      }`}
      style={{
        top: box.top,
        left: box.left,
        width: box.width,
        height: box.height,
        borderRadius: radius,
        boxShadow: rect ? `${RING}, ${BACKDROP}` : BACKDROP,
      }}
    />
  )
}
