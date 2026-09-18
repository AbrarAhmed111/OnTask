// Merges incoming rows into existing state by id rather than naively
// appending/prepending — this is what makes realtime state safe against
// duplicates on reconnect and safe to double-fire without ever rendering
// the same row twice (rules 6 and 26 of the evolution plan). Because
// existing rows keep their identity (same id -> same React key), the CSS
// entrance animation on a list item only plays for genuinely new items —
// it never replays for one that's merely re-delivered or refetched.
export function mergeById<T extends { id: string }>(
  existing: T[],
  incoming: T[],
  sortKey: (item: T) => number,
  limit?: number,
): T[] {
  const map = new Map(existing.map(item => [item.id, item]))
  for (const item of incoming) map.set(item.id, item)
  const merged = Array.from(map.values()).sort(
    (a, b) => sortKey(b) - sortKey(a),
  )
  return typeof limit === 'number' ? merged.slice(0, limit) : merged
}
