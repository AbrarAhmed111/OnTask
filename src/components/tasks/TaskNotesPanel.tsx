'use client'

import { FormEvent, useState } from 'react'
import { Pencil, Send, Trash2, X } from 'lucide-react'
import { useTaskNotes } from '@/hooks/useTaskNotes'
import { timeAgo } from '@/lib/time'
import type { AuthUser } from '@/hooks/useAuth'
import { WorkspaceMember } from '@/types/workspace'

function authorName(authorId: string, members: WorkspaceMember[]) {
  const member = members.find(m => m.userId === authorId)
  return member?.fullName || member?.email || 'Someone'
}

// Shared notes on a single task -- author, content, created/updated -- see
// project_document/ontask-evolution2-plan.md Rules 3, 12, 13. Rendered as an
// expandable panel appended to the existing task card rather than a new
// task-detail surface (there isn't one today, and building one solely to
// host notes would be disproportionate — matches the collapsed/expanded
// pattern WorkspaceParentTaskCard already uses).
export function TaskNotesPanel({
  taskId,
  user,
  members,
}: {
  taskId: string
  user: AuthUser | null
  members: WorkspaceMember[]
}) {
  const { notes, ready, error, addNote, updateNote, deleteNote } = useTaskNotes(
    taskId,
    user,
  )
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')

  const handleAdd = (event: FormEvent) => {
    event.preventDefault()
    if (addNote(draft)) setDraft('')
  }
  const startEdit = (id: string, content: string) => {
    setEditingId(id)
    setEditDraft(content)
  }
  const handleSaveEdit = (event: FormEvent) => {
    event.preventDefault()
    if (!editingId) return
    updateNote(editingId, editDraft)
    setEditingId(null)
  }

  return (
    <div className="space-y-3 rounded-xl border border-line/70 bg-white/50 p-3">
      {error && <p className="text-[11px] text-coral">{error}</p>}
      {!ready ? (
        <p className="text-[11px] text-muted">Loading notes…</p>
      ) : notes.length === 0 ? (
        <p className="text-[11px] text-muted">
          No notes yet — add context the team should know.
        </p>
      ) : (
        <ul className="space-y-2">
          {notes.map(note => {
            const isOwn = note.authorId === user?.id
            const edited = note.updatedAt !== note.createdAt
            return (
              <li
                key={note.id}
                className="animate-[slideInFade_260ms_ease-out] rounded-lg border border-line bg-white px-3 py-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[10px] font-semibold text-ink">
                    {authorName(note.authorId, members)}{' '}
                    <span className="font-normal text-muted">
                      {timeAgo(note.createdAt)}
                      {edited ? ' · edited' : ''}
                    </span>
                  </p>
                  {isOwn && editingId !== note.id && (
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        aria-label="Edit note"
                        onClick={() => startEdit(note.id, note.content)}
                        className="rounded p-1 text-muted transition hover:bg-slate-100 hover:text-ink"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        aria-label="Delete note"
                        onClick={() => deleteNote(note.id)}
                        className="rounded p-1 text-muted transition hover:bg-coral/10 hover:text-coral"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>
                {editingId === note.id ? (
                  <form onSubmit={handleSaveEdit} className="mt-2 space-y-2">
                    <textarea
                      autoFocus
                      value={editDraft}
                      onChange={event => setEditDraft(event.target.value)}
                      rows={2}
                      className="w-full resize-none rounded-lg border border-line bg-white px-2.5 py-2 text-xs text-ink outline-none focus:border-sage focus:ring-4 focus:ring-sage/15"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-lg px-2 py-1 text-[10px] font-semibold text-muted transition hover:bg-slate-100"
                      >
                        <X size={11} className="inline" /> Cancel
                      </button>
                      <button
                        type="submit"
                        className="rounded-lg bg-[var(--ws-accent,#375b4b)] px-2.5 py-1 text-[10px] font-semibold text-white transition hover:opacity-90"
                      >
                        Save
                      </button>
                    </div>
                  </form>
                ) : (
                  <p className="mt-1.5 whitespace-pre-wrap text-xs leading-5 text-ink">
                    {note.content}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <form onSubmit={handleAdd} className="flex items-start gap-2">
        <textarea
          value={draft}
          onChange={event => setDraft(event.target.value)}
          placeholder="Add a note for the team…"
          rows={2}
          className="min-w-0 flex-1 resize-none rounded-lg border border-line bg-white px-2.5 py-2 text-xs text-ink outline-none placeholder:text-muted/60 focus:border-sage focus:ring-4 focus:ring-sage/15"
        />
        <button
          type="submit"
          aria-label="Add note"
          disabled={!draft.trim()}
          className="shrink-0 rounded-lg bg-[var(--ws-accent,#375b4b)] p-2.5 text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  )
}
