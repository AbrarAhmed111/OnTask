import { OctagonAlert } from 'lucide-react'
import { TASK_CHIP_CLASS } from '@/components/tasks/TaskCardShell'

// The card's "this task is stuck" action. Sits with the card's other chip
// buttons; the visible word is short, the accessible name says which task, and
// the tooltip says what it does.
export function BlockerButton({
  taskName,
  onClick,
}: {
  taskName: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Report a blocker on ${taskName}`}
      title="Mark this task as blocked and say what's in the way. Its timer stops."
      className={TASK_CHIP_CLASS}
    >
      <OctagonAlert size={13} /> Blocker
    </button>
  )
}
