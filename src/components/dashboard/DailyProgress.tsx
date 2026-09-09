import { Clock3, Target } from 'lucide-react'
import { formatPlanned, formatTime } from '@/lib/time'
import { ProgressBar } from '@/components/ui/ProgressBar'

export function DailyProgress({
  totalSeconds,
  completedTasks,
  taskCount,
  targetMinutes,
}: {
  totalSeconds: number
  completedTasks: number
  taskCount: number
  targetMinutes: number
}) {
  const targetSeconds = targetMinutes * 60
  const progress = Math.min(100, (totalSeconds / targetSeconds) * 100)
  return (
    <section className="rounded-2xl border border-line bg-white/70 p-5 shadow-sm sm:p-7">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
            <Target size={14} className="text-coral" /> Today&apos;s work
          </div>
          <strong className="text-3xl font-bold tracking-tight text-ink">
            {formatTime(totalSeconds, true)}{' '}
            <small className="text-sm font-medium text-muted">
              / {formatPlanned(targetMinutes)}
            </small>
          </strong>
        </div>
        <span className="font-mono text-lg font-medium text-coral">
          {progress.toFixed(1)}%
        </span>
      </div>
      <ProgressBar value={progress} />
      <div className="mt-4 flex flex-wrap justify-between gap-3 text-[10px] text-muted">
        <span>
          <b className="text-ink">{formatTime(totalSeconds, true)}</b> completed
        </span>
        <span>
          <b className="text-ink">
            {formatTime(Math.max(0, targetSeconds - totalSeconds), true)}
          </b>{' '}
          remaining
        </span>
        <span>
          <b className="text-ink">
            {completedTasks} / {taskCount}
          </b>{' '}
          tasks done
        </span>
      </div>
      <p className="mt-5 flex items-center gap-1.5 text-[10px] text-muted">
        <Clock3 size={13} /> Focused time only. Paused time never counts.
      </p>
    </section>
  )
}
