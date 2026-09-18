'use client'

import { ReactNode, useEffect, useState } from 'react'
import { KIND_STYLES } from '@/components/resources/resourceKinds'
import { useInView } from '@/hooks/useInView'
import {
  canPreviewContent,
  getPreviewKind,
  parseCsvSample,
  PreviewKind,
  readTextSample,
  resourceTypeLabel,
  sampleTextLines,
} from '@/lib/resources'
import { WorkspaceResource } from '@/types/workspace'

// The small visual at the top of a resource card. It exists to help someone
// recognise a file without opening it, so it stays deliberately light:
//
//   images        the real image as a thumbnail
//   text / CSV    the first few lines / rows, read from the first few KB only
//   everything    a drawn file-type visual (document page, sheet grid, slide)
//   else
//
// PDFs, Word, Excel and PowerPoint files use the drawn visual on purpose:
// rendering their first page needs a heavy client-side library (pdf.js, or a
// docx/pptx/xlsx parser) for what is only a ~190px hint. Anything that can't
// be loaded (too big, unreadable, offline, an image the browser can't
// decode) falls back to the same drawn visual, never a broken image.

type Sample = { lines: string[] } | { rows: string[][] }

// Drawn stand-ins for text: a short "title" line, then ragged body lines.
const LINE_WIDTHS = ['w-3/5', 'w-full', 'w-full', 'w-4/5', 'w-full', 'w-2/3']
const PLACEHOLDER_WIDTHS = ['w-3/4', 'w-1/2', 'w-2/3', 'w-1/3']
const SHEET_COLUMNS = 4
const SHEET_PLACEHOLDER_ROWS = 4

type FetchProps = {
  resource: WorkspaceResource
  kind: PreviewKind
  label: string
  inView: boolean
  getSignedUrl: (storagePath: string) => Promise<string | null>
}

export function ResourcePreview({
  resource,
  getSignedUrl,
}: {
  resource: WorkspaceResource
  getSignedUrl: (storagePath: string) => Promise<string | null>
}) {
  const kind = getPreviewKind(resource.fileName, resource.fileType)
  const label = resourceTypeLabel(resource.fileName)
  const [ref, inView] = useInView<HTMLDivElement>()
  const content = canPreviewContent(kind, resource.fileSize)
  const fetchProps = { resource, kind, label, inView, getSignedUrl }

  return (
    <div
      ref={ref}
      className="group/preview relative aspect-[4/3] w-full overflow-hidden bg-slate-100"
    >
      {content === 'image' ? (
        <ImageThumb {...fetchProps} />
      ) : content === 'text' ? (
        <SampleThumb {...fetchProps} />
      ) : (
        <TypeVisual kind={kind} label={label} />
      )}
      <div className="pointer-events-none absolute inset-0 bg-black/0 transition group-hover/preview:bg-black/[0.04]" />
    </div>
  )
}

function PreviewSkeleton() {
  return (
    <div
      aria-hidden
      className="absolute inset-0 animate-pulse bg-slate-200/70"
    />
  )
}

function ImageThumb({
  resource,
  kind,
  label,
  inView,
  getSignedUrl,
}: FetchProps) {
  const [url, setUrl] = useState<string | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading')

  useEffect(() => {
    if (!inView) return
    let cancelled = false
    void getSignedUrl(resource.storagePath).then(signed => {
      if (cancelled) return
      if (signed) setUrl(signed)
      else setState('failed')
    })
    return () => {
      cancelled = true
    }
  }, [inView, resource.storagePath, getSignedUrl])

  if (state === 'failed') return <TypeVisual kind={kind} label={label} />
  return (
    <>
      {state === 'loading' && <PreviewSkeleton />}
      {url && (
        // The signed URL is short-lived and per-viewer, so next/image's
        // optimiser has nothing useful to cache.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={`Preview of ${resource.fileName}`}
          decoding="async"
          onLoad={() => setState('ready')}
          onError={() => setState('failed')}
          className={`h-full w-full object-cover transition duration-300 group-hover/preview:scale-[1.03] ${
            state === 'ready' ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
    </>
  )
}

function SampleThumb({
  resource,
  kind,
  label,
  inView,
  getSignedUrl,
}: FetchProps) {
  const [sample, setSample] = useState<Sample | 'loading' | 'failed'>('loading')

  useEffect(() => {
    if (!inView) return
    const controller = new AbortController()
    void (async () => {
      try {
        const url = await getSignedUrl(resource.storagePath)
        if (!url) throw new Error('could not sign url')
        const text = await readTextSample(
          await fetch(url, { signal: controller.signal }),
        )
        if (controller.signal.aborted) return
        if (text === null) throw new Error('unreadable')
        if (kind === 'csv') {
          const rows = parseCsvSample(text)
          if (!rows || rows.length === 0) throw new Error('no rows')
          setSample({ rows })
        } else {
          const lines = sampleTextLines(text)
          if (!lines || lines.length === 0) throw new Error('no lines')
          setSample({ lines })
        }
      } catch {
        if (!controller.signal.aborted) setSample('failed')
      }
    })()
    return () => controller.abort()
  }, [inView, resource.storagePath, kind, getSignedUrl])

  if (sample === 'loading') return <PreviewSkeleton />
  if (sample === 'failed') return <TypeVisual kind={kind} label={label} />
  return 'rows' in sample ? (
    <SheetVisual kind={kind} label={label} rows={sample.rows} />
  ) : (
    <TextVisual kind={kind} label={label} lines={sample.lines} />
  )
}

// ── Drawn visuals ───────────────────────────────────────────────────────────

export function TypeVisual({
  kind,
  label,
}: {
  kind: PreviewKind
  label: string
}) {
  switch (kind) {
    case 'pdf':
    case 'word':
      return <DocumentVisual kind={kind} label={label} />
    case 'excel':
    case 'csv':
      return <SheetVisual kind={kind} label={label} />
    case 'powerpoint':
      return <SlideVisual kind={kind} label={label} />
    case 'text':
      return <TextVisual kind={kind} label={label} />
    default:
      return <GenericVisual kind={kind} label={label} />
  }
}

function VisualFrame({
  kind,
  label,
  children,
}: {
  kind: PreviewKind
  label: string
  children: ReactNode
}) {
  const { tint, solid } = KIND_STYLES[kind]
  return (
    <div
      aria-hidden
      className={`absolute inset-0 grid place-items-center ${tint}`}
    >
      {children}
      <span
        className={`absolute bottom-2 right-2 rounded px-1.5 py-1 text-[9px] font-bold leading-none tracking-wide text-white shadow-sm ${solid}`}
      >
        {label}
      </span>
    </div>
  )
}

function Page({
  className,
  children,
}: {
  className: string
  children: ReactNode
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[4px] bg-white shadow-md ring-1 ring-black/5 transition-transform duration-300 group-hover/preview:scale-[1.04] ${className}`}
    >
      {children}
    </div>
  )
}

function PlaceholderLines({ count }: { count: number }) {
  return (
    <div className="space-y-1.5">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className={`h-1 rounded-full ${
            index === 0 ? 'bg-slate-300' : 'bg-slate-200'
          } ${LINE_WIDTHS[index % LINE_WIDTHS.length]}`}
        />
      ))}
    </div>
  )
}

function DocumentVisual({ kind, label }: { kind: PreviewKind; label: string }) {
  const { icon: Icon, solid } = KIND_STYLES[kind]
  return (
    <VisualFrame kind={kind} label={label}>
      <Page className="aspect-[3/4] h-[80%]">
        <div className={`flex h-5 items-center px-1.5 ${solid}`}>
          <Icon size={11} className="text-white" />
        </div>
        <div className="px-2.5 pt-2.5">
          <PlaceholderLines count={6} />
        </div>
      </Page>
    </VisualFrame>
  )
}

export function SheetVisual({
  kind,
  label,
  rows,
}: {
  kind: PreviewKind
  label: string
  // Real cells when a sample was read; otherwise a drawn placeholder grid.
  rows?: string[][]
}) {
  const columns = rows ? (rows[0]?.length ?? SHEET_COLUMNS) : SHEET_COLUMNS
  const rowCount = rows ? rows.length : SHEET_PLACEHOLDER_ROWS
  return (
    <VisualFrame kind={kind} label={label}>
      <Page className="h-[80%] w-[84%]">
        <div
          className="grid gap-px bg-slate-200 text-[8px] leading-none"
          style={{
            gridTemplateColumns: `1.1rem repeat(${columns}, minmax(0, 1fr))`,
          }}
        >
          <span className="bg-emerald-100 py-1" />
          {Array.from({ length: columns }, (_, column) => (
            <span
              key={column}
              className="bg-emerald-100 py-1 text-center font-bold text-emerald-700"
            >
              {String.fromCharCode(65 + column)}
            </span>
          ))}
          {Array.from({ length: rowCount }, (_, row) => (
            <SheetRow
              key={row}
              number={row + 1}
              cells={rows?.[row]}
              columns={columns}
              rowIndex={row}
            />
          ))}
        </div>
      </Page>
    </VisualFrame>
  )
}

function SheetRow({
  number,
  cells,
  columns,
  rowIndex,
}: {
  number: number
  cells?: string[]
  columns: number
  rowIndex: number
}) {
  return (
    <>
      <span className="bg-slate-50 py-1 text-center text-slate-400">
        {number}
      </span>
      {Array.from({ length: columns }, (_, column) => (
        <span key={column} className="min-w-0 bg-white px-1 py-1">
          {cells ? (
            <span className="block truncate text-slate-700">
              {cells[column] || <>&nbsp;</>}
            </span>
          ) : (
            <span
              className={`block h-1 rounded-full bg-slate-200 ${
                PLACEHOLDER_WIDTHS[(rowIndex + column) % 4]
              }`}
            />
          )}
        </span>
      ))}
    </>
  )
}

function SlideVisual({ kind, label }: { kind: PreviewKind; label: string }) {
  const { solid } = KIND_STYLES[kind]
  return (
    <VisualFrame kind={kind} label={label}>
      <div className="relative w-[76%]">
        <div className="absolute inset-0 translate-x-1.5 translate-y-1.5 rounded-[4px] bg-white/60 ring-1 ring-black/5" />
        <Page className="aspect-video w-full">
          <div
            className={`absolute left-3 top-3 h-1.5 w-2/5 rounded-full ${solid}`}
          />
          <div className="absolute left-3 top-7 h-1 w-3/5 rounded-full bg-slate-200" />
          <div className="absolute left-3 top-10 h-1 w-1/2 rounded-full bg-slate-200" />
          <div className="absolute bottom-3 right-3 h-1/3 w-1/4 rounded bg-orange-100" />
        </Page>
      </div>
    </VisualFrame>
  )
}

export function TextVisual({
  kind,
  label,
  lines,
}: {
  kind: PreviewKind
  label: string
  // Real lines when a sample was read; otherwise drawn placeholder lines.
  lines?: string[]
}) {
  return (
    <VisualFrame kind={kind} label={label}>
      <Page className="h-[80%] w-[84%]">
        {lines ? (
          <div className="px-2 py-2 font-mono text-[8px] leading-[11px] text-slate-600">
            {lines.map((line, index) => (
              <p
                key={index}
                className="overflow-hidden text-ellipsis whitespace-pre"
              >
                {line}
              </p>
            ))}
          </div>
        ) : (
          <div className="px-2.5 pt-3">
            <PlaceholderLines count={6} />
          </div>
        )}
      </Page>
    </VisualFrame>
  )
}

function GenericVisual({ kind, label }: { kind: PreviewKind; label: string }) {
  const { icon: Icon } = KIND_STYLES[kind]
  return (
    <VisualFrame kind={kind} label={label}>
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white shadow-md ring-1 ring-black/5 transition-transform duration-300 group-hover/preview:scale-105">
        <Icon size={26} className="text-slate-500" />
      </span>
    </VisualFrame>
  )
}
