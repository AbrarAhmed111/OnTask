import type { WorkspaceMember } from '@/types/workspace'

// The pure half of @-mentions: finding the "@name" being typed, filtering the
// workspace's members for it, and keeping a set of mentions consistent with
// the text as it is edited. MentionTextarea is the UI on top of this and knows
// nothing about tasks or blockers, so any future field that lets someone tag a
// workspace member can reuse both.
//
// Identity is ALWAYS a member's userId. The "@Name" that lands in the text is
// only what a reader sees — two members can share a display name, and renaming
// yourself must not change who a saved mention points at — so nothing here (or
// on the server) ever looks a member up by that text.

export const MENTION_TRIGGER = '@'

// How far back from the caret an "@" can be and still open the picker. Long
// enough for a full name, short enough that a stray "@" earlier in a paragraph
// doesn't keep the list open for the rest of the sentence.
const MAX_QUERY_LENGTH = 30
export const MAX_SUGGESTIONS = 8

// One mention inside a piece of text. `start`/`end` are string offsets,
// end-exclusive, of the "@Label" token itself. A mention with start === -1 is
// not anchored in the text at all (the token was never there, or the name has
// changed since it was saved): it is still a mention — it shows as a chip and
// counts for identity — it just has no characters to keep in step.
export type MentionRange = {
  userId: string
  label: string
  start: number
  end: number
}

export type MentionQuery = {
  // Offset of the "@" that opened the query, and of the caret it runs to.
  start: number
  end: number
  // What has been typed after the "@".
  query: string
}

export function mentionLabel(
  member: Pick<WorkspaceMember, 'fullName' | 'email'>,
): string {
  return member.fullName?.trim() || member.email?.trim() || 'Member'
}

export function mentionToken(label: string): string {
  return `${MENTION_TRIGGER}${label}`
}

const isAnchored = (mention: MentionRange) => mention.start >= 0

// The "@query" the caret is currently at the end of, or null when the caret
// isn't in one. The "@" has to start the text or follow whitespace (so an email
// address never opens the picker), the query can't span a line break, and a
// caret inside an existing mention is left alone.
export function findMentionQuery(
  text: string,
  caret: number,
  mentions: readonly MentionRange[] = [],
): MentionQuery | null {
  if (caret < 0 || caret > text.length) return null
  const earliest = Math.max(0, caret - MAX_QUERY_LENGTH - 1)
  for (let index = caret - 1; index >= earliest; index--) {
    const char = text[index]
    if (char === '\n' || char === '\r') return null
    if (char !== MENTION_TRIGGER) continue
    const before = index === 0 ? '' : text[index - 1]
    if (before !== '' && !/\s/.test(before)) return null
    const insideMention = mentions.some(
      mention =>
        isAnchored(mention) && index >= mention.start && index < mention.end,
    )
    if (insideMention) return null
    return { start: index, end: caret, query: text.slice(index + 1, caret) }
  }
  return null
}

// Members whose name or email contains the query, best matches first: a name
// that starts with it, then a word in the name that does, then anywhere (an
// email included). Ties keep the workspace's own member order, so the list
// doesn't reshuffle between keystrokes. Two members with the same name are two
// separate entries — they differ by userId (and usually email).
export function filterMembers(
  members: readonly WorkspaceMember[],
  query: string,
  options: { exclude?: readonly string[]; limit?: number } = {},
): WorkspaceMember[] {
  const { exclude = [], limit = MAX_SUGGESTIONS } = options
  const needle = query.trim().toLowerCase()
  const excluded = new Set(exclude)

  const scored: { member: WorkspaceMember; rank: number; order: number }[] = []
  members.forEach((member, order) => {
    if (excluded.has(member.userId)) return
    const name = (member.fullName ?? '').trim().toLowerCase()
    const email = (member.email ?? '').trim().toLowerCase()
    let rank: number
    if (needle === '') rank = 0
    else if (name.startsWith(needle)) rank = 0
    else if (name.split(/\s+/).some(word => word.startsWith(needle))) rank = 1
    else if (name.includes(needle)) rank = 2
    else if (email.startsWith(needle)) rank = 3
    else if (email.includes(needle)) rank = 4
    else return
    scored.push({ member, rank, order })
  })
  scored.sort((a, b) => a.rank - b.rank || a.order - b.order)
  return scored.slice(0, limit).map(entry => entry.member)
}

// A mention is only as good as the text it points at. Anything whose
// characters no longer read "@Label" at its offsets is dropped, so a mistake
// in tracking an edit can only ever lose a mention — never keep one that no
// longer matches what is on screen.
function intact(text: string, mention: MentionRange): boolean {
  if (!isAnchored(mention)) return true
  return text.slice(mention.start, mention.end) === mentionToken(mention.label)
}

// Carry mentions across an edit of the text. The edit is found as the region
// between the longest common prefix and suffix; a mention entirely before it
// stays put, one entirely after it shifts by the change in length, and one the
// edit touches is dropped — deleting or altering part of "@Araysh" turns the
// rest back into ordinary text. Ambiguous edits (typing a character equal to
// its neighbour next to a token) resolve toward dropping.
export function applyTextEdit(
  previous: string,
  next: string,
  mentions: readonly MentionRange[],
): MentionRange[] {
  if (previous === next) return [...mentions]
  const shortest = Math.min(previous.length, next.length)
  let prefix = 0
  while (prefix < shortest && previous[prefix] === next[prefix]) prefix++
  let suffix = 0
  while (
    suffix < shortest - prefix &&
    previous[previous.length - 1 - suffix] === next[next.length - 1 - suffix]
  )
    suffix++
  const editedEnd = previous.length - suffix
  const delta = next.length - previous.length

  return mentions.flatMap(mention => {
    if (!isAnchored(mention)) return [mention]
    let moved: MentionRange | null = null
    if (mention.end <= prefix) moved = mention
    else if (mention.start >= editedEnd)
      moved = {
        ...mention,
        start: mention.start + delta,
        end: mention.end + delta,
      }
    return moved && intact(next, moved) ? [moved] : []
  })
}

export type MentionInsertion = {
  text: string
  mentions: MentionRange[]
  // Where the caret belongs afterwards: just past the token and its space.
  caret: number
}

// Replace the "@query" the caret is in with the chosen member's "@Label" and a
// following space, and record that member as a mention at exactly those
// characters. Returns null when the result would exceed maxLength.
export function insertMention(
  text: string,
  mentions: readonly MentionRange[],
  query: MentionQuery,
  member: Pick<WorkspaceMember, 'userId' | 'fullName' | 'email'>,
  maxLength = Infinity,
): MentionInsertion | null {
  const label = mentionLabel(member)
  const token = mentionToken(label)
  const after = text.slice(query.end)
  const space = after === '' || !/^\s/.test(after) ? ' ' : ''
  const nextText = text.slice(0, query.start) + token + space + after
  if (nextText.length > maxLength) return null

  const delta = nextText.length - text.length
  const kept = mentions.flatMap(mention => {
    if (!isAnchored(mention)) return [mention]
    if (mention.end <= query.start) return [mention]
    if (mention.start >= query.end)
      return [
        { ...mention, start: mention.start + delta, end: mention.end + delta },
      ]
    return []
  })
  const added: MentionRange = {
    userId: member.userId,
    label,
    start: query.start,
    end: query.start + token.length,
  }
  return {
    text: nextText,
    mentions: [...kept, added].sort((a, b) => a.start - b.start),
    caret: query.start + token.length + space.length,
  }
}

// Take one mention out. An anchored one also loses its "@Label" text (and the
// single space that followed it), so the words the reader sees and the people
// who get notified never disagree.
export function removeMention(
  text: string,
  mentions: readonly MentionRange[],
  index: number,
): { text: string; mentions: MentionRange[] } {
  const target = mentions[index]
  if (!target) return { text, mentions: [...mentions] }
  const rest = mentions.filter((_, i) => i !== index)
  if (!isAnchored(target)) return { text, mentions: rest }

  const removeEnd = text[target.end] === ' ' ? target.end + 1 : target.end
  const removed = removeEnd - target.start
  return {
    text: text.slice(0, target.start) + text.slice(removeEnd),
    mentions: rest.flatMap(mention => {
      if (!isAnchored(mention) || mention.end <= target.start) return [mention]
      return [
        {
          ...mention,
          start: mention.start - removed,
          end: mention.end - removed,
        },
      ]
    }),
  }
}

// The distinct members mentioned, in the order they first appear — what gets
// sent to the server. The same person tagged twice is still one mention.
export function mentionedUserIds(mentions: readonly MentionRange[]): string[] {
  return Array.from(new Set(mentions.map(mention => mention.userId)))
}

// Rebuild editor mentions for a blocker that is being edited. Only user ids
// are stored on the server, so each mentioned member's "@Label" is looked for
// in the saved reason, one occurrence per mention (two members with the same
// name take the first two). One that can't be found stays a chip-only mention
// rather than being lost.
export function mentionsFromText(
  text: string,
  mentioned: readonly Pick<WorkspaceMember, 'userId' | 'fullName' | 'email'>[],
): MentionRange[] {
  const taken: [number, number][] = []
  return mentioned.map(member => {
    const label = mentionLabel(member)
    const token = mentionToken(label)
    let from = 0
    for (;;) {
      const at = text.indexOf(token, from)
      if (at === -1) return { userId: member.userId, label, start: -1, end: -1 }
      const overlaps = taken.some(([s, e]) => at < e && at + token.length > s)
      if (!overlaps) {
        taken.push([at, at + token.length])
        return {
          userId: member.userId,
          label,
          start: at,
          end: at + token.length,
        }
      }
      from = at + 1
    }
  })
}
