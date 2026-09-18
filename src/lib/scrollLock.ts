// While a modal (or an onboarding tour) is open the page behind it must not
// scroll. Reference counted so stacked layers share one lock; the scrollbar's
// width is added back as padding so the page doesn't jump sideways when the
// scrollbar disappears.
//
// Only user scrolling is prevented: a script can still scroll the page, which
// is how a tour brings its next target into view.
let scrollLocks = 0
let restoreScroll: (() => void) | null = null

export function lockBodyScroll(): () => void {
  if (scrollLocks++ === 0) {
    const { body, documentElement } = document
    const previousOverflow = body.style.overflow
    const previousPadding = body.style.paddingRight
    const scrollbarWidth = window.innerWidth - documentElement.clientWidth
    body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`
    restoreScroll = () => {
      body.style.overflow = previousOverflow
      body.style.paddingRight = previousPadding
    }
  }
  let released = false
  return () => {
    if (released) return
    released = true
    if (--scrollLocks === 0) {
      restoreScroll?.()
      restoreScroll = null
    }
  }
}
