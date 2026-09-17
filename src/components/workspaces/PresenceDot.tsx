// Small ring-bordered status dot meant to sit at the bottom-right corner of
// an avatar (parent must be `relative`). Green = has this workspace open
// right now, gray = not currently here.
export function PresenceDot({ online }: { online: boolean }) {
  return (
    <span
      aria-label={online ? 'Online' : 'Offline'}
      title={online ? 'Online now' : 'Not currently here'}
      className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-paper ${
        online ? 'bg-emerald-500' : 'bg-slate-300'
      }`}
    />
  )
}
