'use client'

import { useEffect, useState } from 'react'
import { Loader2, RotateCcw, Save } from 'lucide-react'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { showSuccessToast } from '@/lib/toast'
import {
  loadTasks,
  loadUnresolvedGuestTasks,
  markGuestTasksResolved,
  saveTasks,
} from '@/lib/storage'
import { importGuestTasksToPersonalWorkspace } from '@/lib/tasks/migration'
import { Task } from '@/types'

// "Your guest work is ready. Save it to your Personal Workspace?"
//
// Guest work lives in this browser's localStorage, so the offer can be made
// on whichever signed-in page the user lands on first. Shown only when there
// are local tasks the user hasn't already answered for (see storage.ts).
//
//   Save My Work  -> imports them into the Personal Workspace (one atomic
//                    database call), removes them from this device, reloads.
//   Start Fresh   -> begins with an empty workspace. Nothing is uploaded and
//                    nothing is deleted: the tasks simply stay on this device
//                    for guest mode, and aren't offered again.
//   Closing (X)   -> decides nothing; the offer returns next time.
//
// `suppressed` lets the caller hold the prompt back while another dialog (the
// one-time welcome) is on screen, so the user never faces two at once.
export function GuestWorkPrompt({
  suppressed = false,
}: {
  suppressed?: boolean
}) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [dismissed, setDismissed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setTasks(loadUnresolvedGuestTasks())
  }, [])

  if (suppressed || dismissed || tasks.length === 0) return null

  const handleSave = async () => {
    setLoading(true)
    setError('')
    const result = await importGuestTasksToPersonalWorkspace(tasks)
    if (!result.success) {
      setLoading(false)
      setError(result.error)
      return
    }
    const savedIds = new Set(tasks.map(task => task.id))
    saveTasks(loadTasks().filter(task => !savedIds.has(task.id)))
    markGuestTasksResolved([...savedIds])
    // The personal workspace's goals/tasks were fetched before the import, so
    // reload to show them — same approach the old account migration used.
    window.location.reload()
  }

  const handleStartFresh = () => {
    markGuestTasksResolved(tasks.map(task => task.id))
    setDismissed(true)
    showSuccessToast('Fresh start. Your guest tasks stay on this device.')
  }

  return (
    <Modal
      eyebrow="Your guest work is ready"
      title="Save it to your Personal Workspace?"
      onClose={() => setDismissed(true)}
    >
      <p className="text-xs leading-5 text-muted">
        You have <b className="text-ink">{tasks.length}</b>{' '}
        {tasks.length === 1 ? 'task' : 'tasks'} from before you signed in.
        Saving keeps them in your private workspace — with any focus time
        you&apos;ve recorded — so they follow you across devices.
      </p>
      {error && <ErrorBanner className="mt-4">{error}</ErrorBanner>}
      <div className="mt-5 flex flex-col gap-2">
        <Button
          type="button"
          className="w-full"
          onClick={handleSave}
          disabled={loading}
        >
          {loading ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Save size={15} />
          )}
          Save My Work
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={handleStartFresh}
          disabled={loading}
        >
          <RotateCcw size={15} /> Start Fresh
        </Button>
      </div>
      <p className="mt-4 text-[11px] leading-5 text-muted">
        Start Fresh doesn&apos;t delete anything — your guest tasks just stay on
        this device, separate from your account.
      </p>
    </Modal>
  )
}
