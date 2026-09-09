type ProgressBarProps = {
  value: number
  tone?: 'forest' | 'coral' | 'sage'
  className?: string
}

const tones = { forest: 'bg-forest', coral: 'bg-coral', sage: 'bg-sage' }

export function ProgressBar({
  value,
  tone = 'forest',
  className = '',
}: ProgressBarProps) {
  return (
    <div
      className={`h-2 overflow-hidden rounded-full bg-slate-100 ${className}`}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-500 ease-out ${tones[tone]}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}
