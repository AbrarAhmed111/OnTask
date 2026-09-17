import { ButtonHTMLAttributes } from 'react'

export function Button({
  className = '',
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
}) {
  // `--ws-accent`/`--ws-accent-soft` are only ever set by WorkspaceShell, so
  // outside a workspace these fall back to the app's plain forest/sage and
  // render byte-for-byte the same as a plain bg-forest/bg-sage would.
  const variants = {
    primary:
      'bg-[var(--ws-accent,#375b4b)] text-white shadow-sm hover:opacity-90',
    secondary:
      'bg-[var(--ws-accent-soft,#e9f0ec)] text-[var(--ws-accent,#375b4b)] hover:opacity-80',
    ghost: 'text-muted hover:bg-slate-100 hover:text-ink',
    danger: 'bg-coral/10 text-coral hover:bg-coral/20',
  }
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2.5 text-xs font-semibold transition duration-200 hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
    />
  )
}
