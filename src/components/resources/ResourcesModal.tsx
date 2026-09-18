'use client'

import { ChangeEvent, useRef, useState } from 'react'
import { CirclePlus, FolderOpen, Loader2, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { ResourceCard } from '@/components/resources/ResourceCard'
import { UploadQueue } from '@/components/resources/UploadQueue'
import { categorize, ResourceCategory, SignedUrlGetter } from '@/lib/resources'
import { UploadItem } from '@/lib/resourceUploads'
import { WorkspaceMember, WorkspaceResource } from '@/types/workspace'

const FILTERS: { id: 'all' | ResourceCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'documents', label: 'Documents' },
  { id: 'images', label: 'Images' },
  { id: 'pdfs', label: 'PDFs' },
  { id: 'other', label: 'Other' },
]

// As many columns as fit with each card at least 12rem wide: about four at
// the modal's full width, three or two on a tablet, one on a phone -- and a
// card can never get narrower than its own actions row needs.
const GRID_CLASSES =
  'grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-3'

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ws-accent,#375b4b)]'

type ResourcesPanelProps = {
  resources: WorkspaceResource[]
  members: WorkspaceMember[]
  userId: string | undefined
  isOwner: boolean
  loading: boolean
  uploads: UploadItem[]
  onUpload: (files: File[]) => void
  onDismissUploads: () => void
  onRequestDelete: (resource: WorkspaceResource) => void
  getSignedUrl: SignedUrlGetter
}

export function ResourcesModal({
  resources,
  members,
  userId,
  isOwner,
  loading,
  uploads,
  onUpload,
  onDismissUploads,
  onDelete,
  getSignedUrl,
  onClose,
}: Omit<ResourcesPanelProps, 'onRequestDelete'> & {
  onDelete: (id: string) => void
  onClose: () => void
}) {
  const [pendingDelete, setPendingDelete] = useState<WorkspaceResource | null>(
    null,
  )

  return (
    <>
      <Modal
        eyebrow="Workspace"
        title="Resources"
        onClose={onClose}
        size="lg"
        fill
      >
        <ResourcesPanel
          resources={resources}
          members={members}
          userId={userId}
          isOwner={isOwner}
          loading={loading}
          uploads={uploads}
          onUpload={onUpload}
          onDismissUploads={onDismissUploads}
          onRequestDelete={setPendingDelete}
          getSignedUrl={getSignedUrl}
        />
      </Modal>
      {pendingDelete && (
        <ConfirmModal
          title="Delete this resource?"
          message={`"${pendingDelete.fileName}" will be permanently deleted. This can't be undone.`}
          confirmLabel="Delete"
          onConfirm={() => {
            onDelete(pendingDelete.id)
            setPendingDelete(null)
          }}
          onClose={() => setPendingDelete(null)}
        />
      )}
    </>
  )
}

// The modal's body, split from the dialog chrome so it can be rendered (and
// tested) on its own. Layout, top to bottom: a fixed toolbar (search, add,
// filters), an upload queue while there is one, then the only part that
// scrolls -- the resource grid.
export function ResourcesPanel({
  resources,
  members,
  userId,
  isOwner,
  loading,
  uploads,
  onUpload,
  onDismissUploads,
  onRequestDelete,
  getSignedUrl,
}: ResourcesPanelProps) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | ResourceCategory>('all')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploading = uploads.some(item => item.status === 'uploading')

  const query = search.trim().toLowerCase()
  const filtered = resources.filter(
    resource =>
      (filter === 'all' || categorize(resource.fileType) === filter) &&
      (!query || resource.fileName.toLowerCase().includes(query)),
  )

  const openPicker = () => fileInputRef.current?.click()
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    // Copy before clearing: resetting `value` empties the live FileList.
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (files.length > 0) onUpload(files)
  }

  return (
    <>
      <div className="shrink-0 space-y-3 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 basis-48">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              type="search"
              aria-label="Search resources"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search resources…"
              className="w-full rounded-lg border border-line bg-white py-2.5 pl-9 pr-3 text-sm text-ink outline-none placeholder:text-muted/60 focus:border-sage focus:ring-4 focus:ring-sage/15"
            />
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={openPicker}
            disabled={uploading}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--ws-accent,#375b4b)] px-3.5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING} focus-visible:ring-offset-2`}
          >
            {uploading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Plus size={14} />
            )}
            Add Resources
          </button>
        </div>

        <div
          role="group"
          aria-label="Filter by type"
          className="flex flex-wrap gap-1.5"
        >
          {FILTERS.map(item => (
            <button
              key={item.id}
              type="button"
              aria-pressed={filter === item.id}
              onClick={() => setFilter(item.id)}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${FOCUS_RING} ${
                filter === item.id
                  ? 'border-[var(--ws-accent,#375b4b)] bg-[var(--ws-accent-soft,#e9f0ec)] text-[var(--ws-accent,#375b4b)]'
                  : 'border-line text-muted hover:border-[var(--ws-accent,#375b4b)]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <UploadQueue items={uploads} onDismiss={onDismissUploads} />
      </div>

      {/* The one scrolling region. Negative margins stretch it to the
          dialog's edges so the scrollbar sits at the edge rather than inside
          the padding; `px-6` puts the content back where it was. */}
      <div className="-mx-6 min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-line/70 px-6 pb-6 pt-4">
        {loading ? (
          <ul
            role="list"
            aria-busy="true"
            aria-label="Loading resources"
            className={GRID_CLASSES}
          >
            {Array.from({ length: 8 }, (_, index) => (
              <li
                key={index}
                className="overflow-hidden rounded-2xl border border-line bg-panel"
              >
                <div
                  aria-hidden
                  className="aspect-[4/3] animate-pulse bg-slate-200/70"
                />
                <div className="space-y-2 p-3">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-2.5 w-1/2" />
                  <Skeleton className="h-8 w-full" />
                </div>
              </li>
            ))}
          </ul>
        ) : filtered.length === 0 ? (
          resources.length === 0 ? (
            <EmptyState
              icon={FolderOpen}
              title="No resources yet"
              size="lg"
              action={
                <Button type="button" onClick={openPicker} disabled={uploading}>
                  <CirclePlus size={14} /> Add Resources
                </Button>
              }
            >
              Add documents, images and other files.
            </EmptyState>
          ) : (
            <EmptyState size="lg">No resources match your search.</EmptyState>
          )
        ) : (
          <ul role="list" className={GRID_CLASSES}>
            {filtered.map(resource => (
              <ResourceCard
                key={resource.id}
                resource={resource}
                uploader={members.find(m => m.userId === resource.uploadedBy)}
                canDelete={isOwner || resource.uploadedBy === userId}
                getSignedUrl={getSignedUrl}
                onDelete={onRequestDelete}
              />
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
