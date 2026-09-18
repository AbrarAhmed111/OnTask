'use client'

import { FormEvent, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import {
  MentionTextarea,
  MentionValue,
} from '@/components/mentions/MentionTextarea'
import { mentionsFromText, mentionedUserIds } from '@/lib/mentions'
import { BLOCKER_REASON_MAX } from '@/lib/tasks/blockers'
import type { BlockerInput } from '@/hooks/useTaskBlockerActions'
import type { WorkspaceMember } from '@/types/workspace'

// "What's blocking this task?" — one field, optional @mentions, and two
// buttons. Used to raise a blocker and, with `initial`, to edit the active one
// (same fields; only the wording and the button change).
export function BlockerDialog({
  taskName,
  members,
  actorId,
  initial,
  onSubmit,
  onClose,
}: {
  taskName: string
  // Everyone in the workspace; the field offers the ones that can be mentioned.
  members: WorkspaceMember[]
  // The person typing — already able to resolve, so never offered.
  actorId: string | undefined
  // Present when editing the active blocker.
  initial?: { reason: string; mentionedMembers: WorkspaceMember[] }
  onSubmit: (input: BlockerInput) => void
  onClose: () => void
}) {
  const editing = Boolean(initial)
  const [value, setValue] = useState<MentionValue>(() =>
    initial
      ? {
          text: initial.reason,
          mentions: mentionsFromText(initial.reason, initial.mentionedMembers),
        }
      : { text: '', mentions: [] },
  )
  const reason = value.text.trim()

  const submit = () => {
    if (!reason) return
    onSubmit({
      reason,
      mentionedUserIds: mentionedUserIds(value.mentions),
    })
  }
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    submit()
  }

  return (
    <Modal
      eyebrow={editing ? 'Edit blocker' : 'Blocker'}
      title="What's blocking this task?"
      onClose={onClose}
    >
      <form onSubmit={handleSubmit}>
        <p className="mb-3 text-xs leading-5 text-muted">
          <span className="font-semibold text-ink">{taskName}</span>
          {editing
            ? ' is blocked. Update the reason or who is asked to help.'
            : ' will show as blocked and its timer will stop. Your time so far is kept.'}
        </p>
        <MentionTextarea
          autoFocus
          value={value}
          onChange={setValue}
          members={members}
          exclude={actorId ? [actorId] : []}
          maxLength={BLOCKER_REASON_MAX}
          placeholder="Waiting for API credentials from @Araysh."
          ariaLabel="What's blocking this task?"
          onSubmitShortcut={submit}
        />
        <p className="mt-2 text-[10px] leading-4 text-muted">
          Type @ to mention a workspace member. They&apos;re notified and can
          resolve this blocker. Mentioning someone is optional.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!reason}>
            {editing ? 'Save changes' : 'Block Task'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
