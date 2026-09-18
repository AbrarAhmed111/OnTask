// State and helpers for the Resources multi-file upload queue. Kept free of
// React and Supabase so the rules (per-file isolation, what the user is told)
// are unit-testable; the hook (hooks/useWorkspaceResources) does the I/O.

export type UploadStatus = 'uploading' | 'done' | 'error'

export type UploadItem = {
  id: string
  fileName: string
  fileSize: number
  status: UploadStatus
  // Short, user-facing reason when status is 'error'.
  error?: string
}

export type UploadAction =
  | { type: 'queued'; items: UploadItem[] }
  | { type: 'finished'; id: string; error?: string }
  // Drop everything that isn't still in flight.
  | { type: 'dismissed' }

export function uploadQueueReducer(
  state: UploadItem[],
  action: UploadAction,
): UploadItem[] {
  switch (action.type) {
    case 'queued':
      return [...state, ...action.items]
    case 'finished':
      return state.map(item =>
        item.id === action.id
          ? {
              ...item,
              status: action.error ? 'error' : 'done',
              error: action.error,
            }
          : item,
      )
    case 'dismissed':
      return state.filter(item => item.status === 'uploading')
  }
}

export function summarizeUploads(items: UploadItem[]) {
  const uploading = items.filter(item => item.status === 'uploading').length
  const failed = items.filter(item => item.status === 'error').length
  return {
    total: items.length,
    uploading,
    failed,
    done: items.length - uploading - failed,
  }
}

export function uploadHeadline(items: UploadItem[]): string {
  const { total, uploading, failed, done } = summarizeUploads(items)
  if (uploading > 0) {
    return `Uploading resources… ${done + failed} of ${total} finished`
  }
  if (failed === 0) {
    return total === 1 ? 'Resource uploaded' : 'All resources uploaded'
  }
  return `${done} uploaded, ${failed} failed`
}

// A batch that finished with no failures has nothing left to tell the user,
// so its list can clear itself. Failures stay until dismissed.
export function isCleanFinish(items: UploadItem[]): boolean {
  return items.length > 0 && items.every(item => item.status === 'done')
}

export function describeUploadOutcome(outcome: {
  succeeded: number
  failed: number
}): { tone: 'success' | 'error'; message: string } | null {
  const { succeeded, failed } = outcome
  if (succeeded === 0 && failed === 0) return null
  if (failed === 0) {
    return {
      tone: 'success',
      message:
        succeeded === 1
          ? 'Resource uploaded.'
          : `${succeeded} resources uploaded.`,
    }
  }
  if (succeeded === 0) {
    return {
      tone: 'error',
      message:
        failed === 1
          ? "Couldn't upload the file."
          : `Couldn't upload ${failed} files.`,
    }
  }
  return { tone: 'error', message: `${succeeded} uploaded, ${failed} failed.` }
}

export function classifyUploadError(error: unknown): string {
  const { message = '', status } = (error ?? {}) as {
    message?: string
    status?: number
  }
  if (status === 413 || /exceed|too large|maximum allowed size/i.test(message))
    return 'Too large'
  return 'Upload failed'
}

// Runs `worker` over `items` with at most `limit` in flight. Workers report
// their own success or failure (the upload worker never throws), so one
// file failing can never stop, or discard, the others.
export async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0
  const runners = Array.from(
    { length: Math.min(Math.max(1, limit), items.length) },
    async () => {
      while (next < items.length) {
        const item = items[next++]
        await worker(item)
      }
    },
  )
  await Promise.all(runners)
}
