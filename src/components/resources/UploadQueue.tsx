'use client'

import { CircleAlert, CircleCheck, Loader2 } from 'lucide-react'
import {
  summarizeUploads,
  uploadHeadline,
  UploadItem,
} from '@/lib/resourceUploads'

function StatusIcon({ status }: { status: UploadItem['status'] }) {
  if (status === 'uploading')
    return (
      <Loader2
        size={13}
        aria-hidden
        className="shrink-0 animate-spin text-muted"
      />
    )
  if (status === 'done')
    return (
      <CircleCheck
        size={13}
        aria-hidden
        className="shrink-0 text-[var(--ws-accent,#375b4b)]"
      />
    )
  return <CircleAlert size={13} aria-hidden className="shrink-0 text-coral" />
}

function statusLabel(item: UploadItem): string {
  if (item.status === 'uploading') return 'Uploading…'
  if (item.status === 'done') return 'Uploaded'
  return item.error ?? 'Failed'
}

// A lightweight upload queue: which files are in flight, which landed, which
// didn't. It stays visible after a failure (so nothing is lost silently) until
// dismissed; a fully successful batch is cleared by the hook on its own.
export function UploadQueue({
  items,
  onDismiss,
}: {
  items: UploadItem[]
  onDismiss: () => void
}) {
  if (items.length === 0) return null
  const { uploading } = summarizeUploads(items)

  return (
    <section
      aria-label="Upload progress"
      className="shrink-0 rounded-xl border border-line bg-white/60 p-3"
    >
      <div className="flex items-center justify-between gap-3">
        <p
          role="status"
          className="min-w-0 truncate text-xs font-semibold text-ink"
        >
          {uploadHeadline(items)}
        </p>
        {uploading === 0 && (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-muted transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ws-accent,#375b4b)]"
          >
            Dismiss
          </button>
        )}
      </div>
      <ul role="list" className="mt-2 max-h-28 space-y-1.5 overflow-y-auto">
        {items.map(item => (
          <li
            key={item.id}
            className="flex min-w-0 items-center gap-2 text-[11px]"
          >
            <StatusIcon status={item.status} />
            <span
              className="min-w-0 flex-1 truncate text-ink"
              title={item.fileName}
            >
              {item.fileName}
            </span>
            <span
              className={`shrink-0 font-medium ${
                item.status === 'error' ? 'text-coral' : 'text-muted'
              }`}
            >
              {statusLabel(item)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
