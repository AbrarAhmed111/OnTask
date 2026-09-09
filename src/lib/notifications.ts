export function playCompletionSound() {
  if (typeof window === 'undefined') return
  const AudioContextClass =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  if (!AudioContextClass) return

  const context = new AudioContextClass()
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(660, context.currentTime)
  oscillator.frequency.exponentialRampToValueAtTime(
    880,
    context.currentTime + 0.12,
  )
  gain.gain.setValueAtTime(0.0001, context.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.35)
  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start()
  oscillator.stop(context.currentTime + 0.35)
  oscillator.addEventListener('ended', () => void context.close())
}

export async function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported' as const
  }

  if (Notification.permission !== 'default') return Notification.permission
  return Notification.requestPermission()
}

export function notifyTaskCompletion(taskName: string) {
  if (
    typeof window === 'undefined' ||
    !('Notification' in window) ||
    Notification.permission !== 'granted'
  ) {
    return
  }

  new Notification('OnTask', {
    body: `${taskName} finished for today.`,
    icon: '/favicon.ico',
  })
}
