import { ComponentType } from 'react'

// A single on/off preference row. Shared by the guest Settings dialog and the
// workspace Settings page so a preference looks and behaves the same wherever
// it can be changed.
export function PreferenceToggle({
  icon: Icon,
  title,
  description,
  checked,
  onChange,
  disabled = false,
}: {
  icon: ComponentType<{ size?: number; className?: string }>
  title: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <label
      className={`flex items-start gap-3 rounded-xl border border-line p-3 transition hover:border-sage ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={event => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 accent-[var(--ws-accent,#375b4b)]"
      />
      <span>
        <span className="flex items-center gap-2 text-xs font-semibold text-ink">
          <Icon size={14} className="text-[var(--ws-accent,#375b4b)]" /> {title}
        </span>
        <span className="mt-1 block text-[11px] leading-5 text-muted">
          {description}
        </span>
      </span>
    </label>
  )
}
