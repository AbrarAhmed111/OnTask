import { useCallback, useState } from 'react'

// State behind the "task finished" alarm dialog, for a guest's local tasks and
// for every kind of workspace task alike.
//
// The dialog exists to play — and let you stop — the alarm, so the
// completion-sound preference gates it: with sound off nothing is shown at
// all (the browser notification, if permitted, still fires separately).
// `soundEnabled` is passed in rather than read here so the caller stays the
// single owner of the preference's state (see useSettings).
export function useCompletionAlert<T extends { name: string }>(
  soundEnabled: boolean,
) {
  const [task, setTask] = useState<T | null>(null)

  const notify = useCallback(
    (finished: T) => {
      if (soundEnabled) setTask(finished)
    },
    [soundEnabled],
  )
  const dismiss = useCallback(() => setTask(null), [])

  return { task, notify, dismiss }
}
