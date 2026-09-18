'use client'

import {
  Clock,
  History,
  ListChecks,
  Lock,
  Sparkles,
  Target,
} from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

const HIGHLIGHTS = [
  { icon: Target, text: 'Create goals and track progress' },
  { icon: ListChecks, text: 'Organize projects, tasks and subtasks' },
  { icon: Clock, text: 'Track focused work time' },
  { icon: History, text: 'View your activity and history' },
  { icon: Sparkles, text: 'Generate AI-powered daily reports' },
  { icon: Lock, text: 'Keep your work private and saved' },
]

// The one-time welcome shown the first time someone opens their Personal
// Workspace (see usePersonalWelcome). Plain informational dialog: closing it
// any way — the button, the X, Escape, clicking outside — just dismisses it.
export function PersonalWelcomeModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal
      eyebrow="Welcome"
      title="Welcome to your Personal Workspace"
      onClose={onClose}
    >
      <p className="text-xs leading-5 text-muted">
        Your private space to plan, work, and track your progress.
      </p>
      <p className="mb-3 mt-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
        You can
      </p>
      <ul className="space-y-2.5">
        {HIGHLIGHTS.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-3 text-xs text-ink">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--ws-accent-soft,#e9f0ec)] text-[var(--ws-accent,#375b4b)]">
              <Icon size={14} />
            </span>
            {text}
          </li>
        ))}
      </ul>
      <Button type="button" className="mt-6 w-full" onClick={onClose}>
        Start Working
      </Button>
    </Modal>
  )
}
