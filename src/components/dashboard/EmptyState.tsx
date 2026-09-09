import { ClipboardPlus } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-sage/60 bg-white/45 px-6 py-16 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-sage/20 text-forest">
        <ClipboardPlus size={22} />
      </div>
      <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-coral">
        Your day starts here
      </p>
      <h2 className="mt-2 text-2xl font-bold tracking-tight text-ink">
        What are you working on today?
      </h2>
      <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted">
        Create a focused plan for the work you want to accomplish. You can
        always adjust it as your day changes.
      </p>
      <Button className="mt-7" onClick={onAdd}>
        <ClipboardPlus size={16} /> Add your first task
      </Button>
    </div>
  )
}
