'use client'

import { useEffect, useState } from 'react'

// Whether a modal dialog is on screen. Modals portal straight into <body>
// (see ui/Modal), so watching <body>'s direct children is enough to notice one
// opening or closing without wiring every dialog into the tour. The tour's own
// popover is a non-modal dialog (no aria-modal), so it never counts.
export function useModalOpen() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const check = () =>
      setOpen(
        document.querySelector('[role="dialog"][aria-modal="true"]') !== null,
      )
    check()
    const observer = new MutationObserver(check)
    observer.observe(document.body, { childList: true })
    return () => observer.disconnect()
  }, [])

  return open
}
