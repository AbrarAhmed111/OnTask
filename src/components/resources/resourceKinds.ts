import {
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType,
  Presentation,
} from 'lucide-react'
import type { ComponentType } from 'react'
import type { PreviewKind } from '@/lib/resources'

export type KindStyle = {
  icon: ComponentType<{ size?: number; className?: string }>
  // Soft background behind the preview visual.
  tint: string
  // Solid accent for the visual's header band / type badge.
  solid: string
}

// One place decides how each file type looks, so the Resources card on the
// workspace page and the cards in the modal never disagree. Classes are
// spelled out in full so Tailwind can see them.
export const KIND_STYLES: Record<PreviewKind, KindStyle> = {
  image: { icon: FileImage, tint: 'bg-slate-100', solid: 'bg-slate-500' },
  pdf: { icon: FileText, tint: 'bg-rose-50', solid: 'bg-rose-500' },
  word: { icon: FileType, tint: 'bg-blue-50', solid: 'bg-blue-500' },
  excel: {
    icon: FileSpreadsheet,
    tint: 'bg-emerald-50',
    solid: 'bg-emerald-600',
  },
  csv: {
    icon: FileSpreadsheet,
    tint: 'bg-emerald-50',
    solid: 'bg-emerald-600',
  },
  powerpoint: {
    icon: Presentation,
    tint: 'bg-orange-50',
    solid: 'bg-orange-500',
  },
  text: { icon: FileText, tint: 'bg-slate-100', solid: 'bg-slate-500' },
  other: { icon: File, tint: 'bg-slate-100', solid: 'bg-slate-500' },
}
