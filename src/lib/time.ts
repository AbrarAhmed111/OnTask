// The single canonical "Xh Ym" formatter for the Daily Report -- floor/floor,
// no padding, no seconds (mirrors ontask-llm's summary_service.py::_format_hm
// exactly, byte for byte). Every place that renders a Daily Report duration
// (member totals, the workspace total, the deterministic fallback narrative)
// must go through this one function so the same number of seconds always
// reads the same way everywhere, instead of each call site rounding it
// slightly differently.
export function formatHM(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  return `${hours}h ${minutes}m`
}

export function formatTime(seconds: number, short = false) {
  const safe = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const secs = safe % 60
  if (short && hours === 0) return `${minutes}m`
  return `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m${short ? '' : ` ${String(secs).padStart(2, '0')}s`}`
}

export function formatPlanned(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return hours
    ? `${hours}h${remainder ? ` ${remainder}m` : ''}`
    : `${remainder}m`
}
