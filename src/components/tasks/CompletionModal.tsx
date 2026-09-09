'use client'

import { useEffect, useRef } from 'react'
import { BellRing, Square } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

export function CompletionModal({
  taskName,
  onStop,
}: {
  taskName: string
  onStop: () => void
}) {
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    audio.loop = true
    void audio.play().catch(() => {
      // Browsers may require a user gesture before allowing audio playback.
    })
    return () => {
      audio.pause()
      audio.currentTime = 0
    }
  }, [])

  return (
    <Modal
      eyebrow="Task complete"
      title={`${taskName} finished for today.`}
      onClose={onStop}
    >
      <audio
        ref={audioRef}
        src="/audio/alarm-tone.mp3"
        preload="auto"
        aria-hidden="true"
      />
      <div className="rounded-xl border border-sage/40 bg-sage/10 p-4">
        <div className="flex items-center gap-3 text-forest">
          <BellRing size={20} />
          <p className="text-sm font-semibold">
            Your focus session is complete.
          </p>
        </div>
        <p className="mt-2 text-xs leading-5 text-muted">
          The alarm will continue until you stop it.
        </p>
      </div>
      <Button type="button" className="mt-5 w-full" onClick={onStop}>
        <Square size={15} /> Stop sound
      </Button>
    </Modal>
  )
}
