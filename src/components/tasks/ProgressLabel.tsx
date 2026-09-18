import { Target } from 'lucide-react'
import { ProgressBar } from '@/components/ui/ProgressBar'

// A free-text label + manual percent a member can track on any task —
// unrelated to workspace Goals (src/components/goals/*), which are a real
// hierarchical entity with their own tasks/subtasks/dependencies.
export function ProgressLabel({
  name,
  progress,
}: {
  name: string
  progress: number
}) {
  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-1.5 truncate text-[10px] font-medium text-muted">
          <Target size={13} className="shrink-0 text-sage" /> {name}
        </span>
        <b className="font-mono text-sm font-medium text-forest">{progress}%</b>
      </div>
      <ProgressBar value={progress} tone="sage" className="h-1.5" />
      <p className="mt-2 text-[10px] text-muted">
        {progress}% complete · {100 - progress}% remaining
      </p>
    </div>
  )
}
