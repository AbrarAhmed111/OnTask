import {
  AlertTriangle,
  ArrowRight,
  CirclePlus,
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  FolderOpen,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { useOptionalWorkspaceDetail } from '@/components/workspaces/WorkspaceDetailContext'
import { categorize } from '@/lib/resources'
import { WorkspaceResource } from '@/types/workspace'

const ICONS = {
  pdfs: FileText,
  images: FileImage,
  documents: FileSpreadsheet,
  other: File,
}

const PREVIEW_COUNT = 3

function TypeChip({ resource }: { resource: WorkspaceResource }) {
  const Icon = ICONS[categorize(resource.fileType)]
  return (
    <span
      title={resource.fileName}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-panel bg-[var(--ws-accent-soft,#e9f0ec)] text-[var(--ws-accent,#375b4b)]"
    >
      <Icon size={14} />
    </span>
  )
}

export function WorkspaceResourcesSection({
  ready,
  error,
  resources,
  onOpen,
  onAddResource,
}: {
  ready: boolean
  error?: string | null
  resources: WorkspaceResource[]
  onOpen: () => void
  onAddResource: () => void
}) {
  const preview = resources.slice(0, PREVIEW_COUNT)
  const isPersonal = useOptionalWorkspaceDetail()?.isPersonal ?? false

  return (
    <div className="rounded-2xl border border-line bg-panel p-5 shadow-sm sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-bold tracking-tight text-ink">
          <FolderOpen size={15} className="text-[var(--ws-accent,#375b4b)]" />
          Resources
        </h2>
        {ready && resources.length > 0 && (
          <button
            onClick={onOpen}
            className="flex items-center gap-1 text-[11px] font-semibold text-[var(--ws-accent,#375b4b)] transition hover:text-coral"
          >
            View Resources <ArrowRight size={12} />
          </button>
        )}
      </div>

      {ready && error && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-coral/20 bg-coral/5 p-3 text-xs leading-5 text-coral">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!ready ? (
        <Skeleton className="mt-4 h-16 rounded-xl" />
      ) : resources.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-sage/70 px-5 py-8 text-center">
          <FolderOpen size={22} className="mx-auto text-sage" />
          <p className="mt-3 text-xs font-semibold text-ink">
            No resources yet
          </p>
          <p className="mx-auto mt-1 max-w-xs text-[11px] leading-5 text-muted">
            {isPersonal
              ? 'Add documents, images and other files you need.'
              : 'Add documents, images and other files the team needs.'}
          </p>
          <Button onClick={onAddResource} className="mx-auto mt-4">
            <CirclePlus size={14} /> Add Resource
          </Button>
        </div>
      ) : (
        <button
          onClick={onOpen}
          className="mt-4 flex w-full items-center gap-4 rounded-xl border border-line/70 bg-white/50 p-3 text-left transition hover:border-[var(--ws-accent,#375b4b)]"
        >
          <div className="flex -space-x-2">
            {preview.map(resource => (
              <TypeChip key={resource.id} resource={resource} />
            ))}
          </div>
          <p className="text-xs font-semibold text-ink">
            {resources.length}{' '}
            {resources.length === 1 ? 'resource' : 'resources'}
          </p>
        </button>
      )}
    </div>
  )
}
