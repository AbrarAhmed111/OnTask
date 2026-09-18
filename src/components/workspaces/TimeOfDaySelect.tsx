'use client'

import { formatTimeOfDay } from '@/lib/dailyReportWindow'

// 15-minute increments only (00:00, 00:15, 00:30 ... 23:45) -- a dropdown
// instead of a native `<input type="time">` both guarantees this (the
// native picker's `step` attribute doesn't reliably block manual keyboard
// entry across browsers) and lets it pick up the workspace's accent color,
// which a native time picker's own popover UI can't be styled with.
const OPTIONS = Array.from({ length: 24 * 4 }, (_, i) => {
  const hour = Math.floor(i / 4)
  const minute = (i % 4) * 15
  const value = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  return { value, label: formatTimeOfDay(`${value}:00`) }
})

export function TimeOfDaySelect({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <select
      required
      value={value}
      onChange={event => onChange(event.target.value)}
      className="mt-2 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-[var(--ws-accent,#375b4b)] focus:ring-4 focus:ring-[var(--ws-accent-soft,#e9f0ec)]"
    >
      {OPTIONS.map(option => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}
