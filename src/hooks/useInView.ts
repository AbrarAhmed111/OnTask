import { useEffect, useRef, useState } from 'react'

// True once the element has scrolled into (or near) view, and it stays true.
// Used to hold back per-card work -- signing a URL, fetching a thumbnail --
// until a card can actually be seen, so a workspace with dozens of resources
// doesn't fire dozens of requests the moment the modal opens.
export function useInView<T extends Element>(rootMargin = '200px') {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element || inView) return
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          setInView(true)
          observer.disconnect()
        }
      },
      { rootMargin },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [inView, rootMargin])

  return [ref, inView] as const
}
