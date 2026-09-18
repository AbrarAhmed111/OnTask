'use client'

import { useEffect, useState } from 'react'
import {
  Download,
  Eye,
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  Trash2,
} from 'lucide-react'
import { categorize, formatFileSize } from '@/lib/resources'
import { timeAgo } from '@/lib/time'
import { WorkspaceMember, WorkspaceResource } from '@/types/workspace'

const ICONS = {
  pdfs: FileText,
  images: FileImage,
  documents: FileSpreadsheet,
  other: File,
}

export function ResourceCard({
  resource,
  uploader,
  canDelete,
  getSignedUrl,
  onDelete,
}: {
  resource: WorkspaceResource
  uploader?: WorkspaceMember
  canDelete: boolean
  getSignedUrl: (storagePath: string) => Promise<string | null>
  onDelete: (id: string) => void
}) {
  const category = categorize(resource.fileType)
  const Icon = ICONS[category]
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)

  useEffect(() => {
    if (category !== 'images') return
    let cancelled = false
    void getSignedUrl(resource.storagePath).then(url => {
      if (!cancelled) setThumbnailUrl(url)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource.storagePath, category])

  const handlePreviewOrDownload = async (download: boolean) => {
    const url = await getSignedUrl(resource.storagePath)
    if (!url) return
    const link = document.createElement('a')
    link.href = url
    if (download) link.download = resource.fileName
    else link.target = '_blank'
    link.rel = 'noreferrer'
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  return (
    <div className="animate-[slideInFade_260ms_ease-out] rounded-2xl border border-line bg-panel p-4 shadow-sm transition hover:shadow-md">
      <div className="grid h-28 w-full place-items-center overflow-hidden rounded-xl bg-slate-50">
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <Icon size={28} className="text-muted" />
        )}
      </div>
      <p
        className="mt-3 truncate text-xs font-bold text-ink"
        title={resource.fileName}
      >
        {resource.fileName}
      </p>
      <p className="mt-1 text-[10px] text-muted">
        {formatFileSize(resource.fileSize)} ·{' '}
        {uploader?.fullName || uploader?.email || 'Someone'} ·{' '}
        {timeAgo(resource.createdAt)}
      </p>
      <div className="mt-3 flex items-center gap-1.5">
        <button
          aria-label={`Preview ${resource.fileName}`}
          onClick={() => handlePreviewOrDownload(false)}
          className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-line px-2 py-1.5 text-[10px] font-semibold text-muted transition hover:border-[var(--ws-accent,#375b4b)] hover:text-[var(--ws-accent,#375b4b)]"
        >
          <Eye size={12} /> Preview
        </button>
        <button
          aria-label={`Download ${resource.fileName}`}
          onClick={() => handlePreviewOrDownload(true)}
          className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-line px-2 py-1.5 text-[10px] font-semibold text-muted transition hover:border-[var(--ws-accent,#375b4b)] hover:text-[var(--ws-accent,#375b4b)]"
        >
          <Download size={12} /> Download
        </button>
        {canDelete && (
          <button
            aria-label={`Delete ${resource.fileName}`}
            onClick={() => onDelete(resource.id)}
            className="rounded-lg p-1.5 text-muted transition hover:bg-coral/10 hover:text-coral"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  )
}
