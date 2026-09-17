'use client'

import { useState } from 'react'
import { AlertTriangle, Cloud, HardDrive, Loader2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { MigrationResult } from '@/lib/tasks/migration'

export function MigrationModal({
  taskCount,
  onMigrate,
  onKeepLocal,
  onClose,
}: {
  taskCount: number
  onMigrate: () => Promise<MigrationResult>
  onKeepLocal: () => void
  onClose: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleMigrate = async () => {
    setLoading(true)
    setError('')
    const result = await onMigrate()
    if (!result.success) {
      setLoading(false)
      setError(result.error)
    }
    // on success the caller reloads the page, so no need to clear loading
  }

  return (
    <Modal
      eyebrow="Local tasks found"
      title="Move your tasks to this account?"
      onClose={onClose}
    >
      <p className="text-xs leading-5 text-muted">
        You have <b className="text-ink">{taskCount}</b>{' '}
        {taskCount === 1 ? 'task' : 'tasks'} saved on this device that
        aren&apos;t part of your account yet.
      </p>
      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-coral/20 bg-coral/5 p-3 text-xs leading-5 text-coral">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <div className="mt-5 flex flex-col gap-2">
        <Button
          type="button"
          className="w-full"
          onClick={handleMigrate}
          disabled={loading}
        >
          {loading ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Cloud size={15} />
          )}
          Move to my account
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={onKeepLocal}
          disabled={loading}
        >
          <HardDrive size={15} /> Keep on this device only
        </Button>
      </div>
      <p className="mt-4 text-[11px] leading-5 text-muted">
        Moving copies your local tasks — including any recorded focus time —
        into your account, then clears them from this device. Keeping them local
        leaves this device&apos;s tasks untouched and separate from your
        account.
      </p>
    </Modal>
  )
}
