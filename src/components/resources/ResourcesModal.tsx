'use client'

import { ChangeEvent, useRef, useState } from 'react'
import { Loader2, Search, Upload } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { ResourceCard } from '@/components/resources/ResourceCard'
import { categorize, ResourceCategory } from '@/lib/resources'
import { WorkspaceMember, WorkspaceResource } from '@/types/workspace'

const FILTERS: { id: 'all' | ResourceCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'documents', label: 'Documents' },
  { id: 'images', label: 'Images' },
  { id: 'pdfs', label: 'PDFs' },
  { id: 'other', label: 'Other' },
]

export function ResourcesModal({
  resources,
  members,
  userId,
  isOwner,
  uploading,
  onUpload,
  onDelete,
  getSignedUrl,
  onClose,
}: {
  resources: WorkspaceResource[]
  members: WorkspaceMember[]
  userId: string | undefined
  isOwner: boolean
  uploading: boolean
  onUpload: (file: File) => void
  onDelete: (id: string) => void
  getSignedUrl: (storagePath: string) => Promise<string | null>
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | ResourceCategory>('all')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const filtered = resources.filter(resource => {
    if (filter !== 'all' && categorize(resource.fileType) !== filter)
      return false
    if (
      search &&
      !resource.fileName.toLowerCase().includes(search.trim().toLowerCase())
    )
      return false
    return true
  })

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) onUpload(file)
    event.target.value = ''
  }

  return (
    <Modal eyebrow="Workspace" title="Resources" onClose={onClose} size="lg">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search resources…"
              className="w-full rounded-lg border border-line bg-white py-2.5 pl-9 pr-3 text-sm text-ink outline-none placeholder:text-muted/60 focus:border-sage focus:ring-4 focus:ring-sage/15"
            />
          </div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--ws-accent,#375b4b)] px-3.5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Upload size={14} />
            )}
            Upload
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map(item => (
            <button
              key={item.id}
              onClick={() => setFilter(item.id)}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
                filter === item.id
                  ? 'border-[var(--ws-accent,#375b4b)] bg-[var(--ws-accent-soft,#e9f0ec)] text-[var(--ws-accent,#375b4b)]'
                  : 'border-line text-muted hover:border-[var(--ws-accent,#375b4b)]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-sage/70 px-5 py-14 text-center text-xs text-muted">
            {resources.length === 0
              ? 'No resources yet — upload the first one.'
              : 'No resources match your search.'}
          </div>
        ) : (
          <div className="grid max-h-[55vh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-4">
            {filtered.map(resource => (
              <ResourceCard
                key={resource.id}
                resource={resource}
                uploader={members.find(m => m.userId === resource.uploadedBy)}
                canDelete={isOwner || resource.uploadedBy === userId}
                getSignedUrl={getSignedUrl}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}
