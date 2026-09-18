export type TaskMoveOption = { id: string; name: string }

// "Standalone" / "Move to <parent>" picker on a task card — how a task is
// moved between parents (or out to the top level) where hierarchy exists.
export function TaskMoveSelect({
  taskName,
  parentTaskId,
  options,
  onMove,
}: {
  taskName: string
  parentTaskId: string | null
  options?: TaskMoveOption[]
  onMove: (parentId: string | null) => void
}) {
  return (
    <select
      aria-label={`Move ${taskName}`}
      value={parentTaskId ?? ''}
      onChange={event => onMove(event.target.value || null)}
      className="rounded-full border border-line bg-white/70 px-2.5 py-1.5 text-[10px] font-semibold text-muted outline-none transition hover:border-[var(--ws-accent,#375b4b)] focus:border-sage"
    >
      <option value="">Standalone</option>
      {options?.map(option => (
        <option key={option.id} value={option.id}>
          Move to &quot;{option.name}&quot;
        </option>
      ))}
    </select>
  )
}
