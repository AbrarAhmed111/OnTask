import { describe, expect, it } from 'vitest'
import {
  MentionRange,
  applyTextEdit,
  filterMembers,
  findMentionQuery,
  insertMention,
  mentionLabel,
  mentionedUserIds,
  mentionsFromText,
  removeMention,
} from '@/lib/mentions'
import type { WorkspaceMember } from '@/types/workspace'

const member = (
  userId: string,
  fullName: string | null,
  email: string | null = `${userId}@example.com`,
): WorkspaceMember => ({
  id: `m-${userId}`,
  workspaceId: 'w1',
  userId,
  role: 'member',
  joinedAt: '2026-01-01',
  fullName,
  email,
  avatarUrl: null,
})

const abrar = member('u-abrar', 'Abrar Ahmed', 'abrar@example.com')
// A different person who happens to share a display name with Abrar.
const abrar2 = member('u-abrar2', 'Abrar Ahmed', 'abrar.ahmed@other.org')
const araysh = member('u-araysh', 'Araysh Khan', 'araysh@example.com')
const rachel = member('u-rachel', 'Rachel Smith', 'rachel@example.com')
const noName = member('u-noname', null, 'quiet@example.com')

describe('findMentionQuery', () => {
  it('finds the @query the caret is at the end of', () => {
    const text = 'Waiting for @Ara'
    expect(findMentionQuery(text, text.length)).toEqual({
      start: 12,
      end: 16,
      query: 'Ara',
    })
  })

  it('opens on a bare @, at the start of the text or after a space', () => {
    expect(findMentionQuery('@', 1)).toEqual({ start: 0, end: 1, query: '' })
    expect(findMentionQuery('hi @', 4)).toEqual({ start: 3, end: 4, query: '' })
  })

  it('lets the query carry on across a space, since names have them', () => {
    expect(findMentionQuery('cc @Abrar Ah', 12)?.query).toBe('Abrar Ah')
  })

  it('does not treat an email address as a mention', () => {
    expect(findMentionQuery('write to a@b.com', 16)).toBeNull()
  })

  it('does not reach back across a line break', () => {
    const text = 'see @Ara\nnext line'
    expect(findMentionQuery(text, text.length)).toBeNull()
  })

  it('does not stay open for a stray @ far behind the caret', () => {
    const text = `@${'x'.repeat(60)}`
    expect(findMentionQuery(text, text.length)).toBeNull()
  })

  it('stays out of a mention that is already there', () => {
    const text = 'from @Araysh Khan today'
    const mentions: MentionRange[] = [
      { userId: 'u-araysh', label: 'Araysh Khan', start: 5, end: 17 },
    ]
    expect(findMentionQuery(text, 10, mentions)).toBeNull()
  })

  it('ignores a caret outside the text', () => {
    expect(findMentionQuery('abc', 9)).toBeNull()
    expect(findMentionQuery('abc', -1)).toBeNull()
  })
})

describe('filterMembers', () => {
  const all = [abrar, abrar2, araysh, rachel, noName]

  it('searches by name', () => {
    expect(filterMembers(all, 'rach').map(m => m.userId)).toEqual(['u-rachel'])
  })

  it('searches by email', () => {
    expect(filterMembers(all, 'quiet@').map(m => m.userId)).toEqual([
      'u-noname',
    ])
    expect(filterMembers(all, 'other.org').map(m => m.userId)).toEqual([
      'u-abrar2',
    ])
  })

  it('is case-insensitive and ignores surrounding whitespace', () => {
    expect(filterMembers(all, '  RACHEL ').map(m => m.userId)).toEqual([
      'u-rachel',
    ])
  })

  it('keeps two members with the same name as two separate entries', () => {
    const found = filterMembers(all, 'abrar')
    expect(found.map(m => m.userId)).toEqual(['u-abrar', 'u-abrar2'])
    expect(new Set(found.map(m => m.userId)).size).toBe(2)
    expect(found.map(mentionLabel)).toEqual(['Abrar Ahmed', 'Abrar Ahmed'])
  })

  it('can search by the name they share and still tell them apart by email', () => {
    const found = filterMembers(all, 'ahmed')
    expect(found.map(m => m.email)).toEqual([
      'abrar@example.com',
      'abrar.ahmed@other.org',
    ])
  })

  it('never offers anyone it was told to leave out', () => {
    expect(
      filterMembers(all, 'abrar', { exclude: ['u-abrar'] }).map(m => m.userId),
    ).toEqual(['u-abrar2'])
  })

  it('only ever offers the members it is given (non-members cannot appear)', () => {
    const found = filterMembers([araysh], 'rachel')
    expect(found).toEqual([])
  })

  it('offers everyone, in workspace order, for an empty query', () => {
    expect(
      filterMembers(all, '', { exclude: ['u-noname'] }).map(m => m.userId),
    ).toEqual(['u-abrar', 'u-abrar2', 'u-araysh', 'u-rachel'])
  })

  it('ranks a name that starts with the query above one that merely contains it', () => {
    const smith = member('u-smith', 'Sam Smith')
    const smithers = member('u-smithers', 'Smithers Jones')
    expect(
      filterMembers([smith, smithers], 'smith').map(m => m.userId),
    ).toEqual(['u-smithers', 'u-smith'])
  })

  it('limits the list', () => {
    expect(filterMembers(all, '', { limit: 2 })).toHaveLength(2)
  })

  it('labels a member without a name by their email', () => {
    expect(mentionLabel(noName)).toBe('quiet@example.com')
  })
})

describe('insertMention', () => {
  it('replaces the @query with the member and records them at those characters', () => {
    const text = 'Waiting for @ara'
    const query = findMentionQuery(text, text.length)!
    const result = insertMention(text, [], query, araysh)!
    expect(result.text).toBe('Waiting for @Araysh Khan ')
    expect(result.mentions).toEqual([
      { userId: 'u-araysh', label: 'Araysh Khan', start: 12, end: 24 },
    ])
    expect(
      result.text.slice(result.mentions[0].start, result.mentions[0].end),
    ).toBe('@Araysh Khan')
    expect(result.caret).toBe(result.text.length)
  })

  it('stores the userId, not the name', () => {
    const query = findMentionQuery('@', 1)!
    const result = insertMention('@', [], query, abrar2)!
    expect(result.mentions[0].userId).toBe('u-abrar2')
  })

  it('keeps two same-named members apart', () => {
    let text = '@'
    let mentions: MentionRange[] = []
    let query = findMentionQuery(text, text.length)!
    let next = insertMention(text, mentions, query, abrar)!
    text = `${next.text}and @`
    mentions = next.mentions
    query = findMentionQuery(text, text.length, mentions)!
    next = insertMention(text, mentions, query, abrar2)!

    expect(next.text).toBe('@Abrar Ahmed and @Abrar Ahmed ')
    expect(next.mentions.map(m => m.userId)).toEqual(['u-abrar', 'u-abrar2'])
    expect(mentionedUserIds(next.mentions)).toEqual(['u-abrar', 'u-abrar2'])
  })

  it('shifts a mention that comes later in the text', () => {
    const text = 'ask @x then @Rachel Smith'
    const mentions: MentionRange[] = [
      { userId: 'u-rachel', label: 'Rachel Smith', start: 12, end: 25 },
    ]
    const query = { start: 4, end: 6, query: 'x' }
    const result = insertMention(text, mentions, query, araysh)!
    expect(result.text).toBe('ask @Araysh Khan then @Rachel Smith')
    const rachelAt = result.mentions.find(m => m.userId === 'u-rachel')!
    expect(result.text.slice(rachelAt.start, rachelAt.end)).toBe(
      '@Rachel Smith',
    )
  })

  it('does not add a second space when one already follows', () => {
    const text = '@ok now'
    const result = insertMention(
      text,
      [],
      { start: 0, end: 3, query: 'ok' },
      araysh,
    )!
    expect(result.text).toBe('@Araysh Khan now')
  })

  it('refuses to go past the length limit', () => {
    expect(
      insertMention('@', [], { start: 0, end: 1, query: '' }, araysh, 5),
    ).toBeNull()
  })
})

describe('applyTextEdit', () => {
  const text = 'Waiting on @Araysh Khan to reply'
  const mention: MentionRange = {
    userId: 'u-araysh',
    label: 'Araysh Khan',
    start: 11,
    end: 23,
  }

  it('leaves a mention alone when the text after it changes', () => {
    const next = `${text} soon`
    expect(applyTextEdit(text, next, [mention])).toEqual([mention])
  })

  it('shifts a mention when text is added before it', () => {
    const next = `Still ${text}`
    const [moved] = applyTextEdit(text, next, [mention])
    expect(moved.start).toBe(17)
    expect(next.slice(moved.start, moved.end)).toBe('@Araysh Khan')
    expect(moved.userId).toBe('u-araysh')
  })

  it('shifts a mention back when text before it is deleted', () => {
    const next = text.slice(8)
    const [moved] = applyTextEdit(text, next, [mention])
    expect(next.slice(moved.start, moved.end)).toBe('@Araysh Khan')
  })

  it('drops a mention whose name is edited', () => {
    const next = text.replace('Araysh', 'Arayshx')
    expect(applyTextEdit(text, next, [mention])).toEqual([])
  })

  it('drops a mention when part of its name is deleted', () => {
    const next = text.replace('@Araysh Khan', '@Araysh')
    expect(applyTextEdit(text, next, [mention])).toEqual([])
  })

  it('drops a mention when the whole thing is deleted', () => {
    const next = text.replace('@Araysh Khan ', '')
    expect(applyTextEdit(text, next, [mention])).toEqual([])
  })

  it('drops a mention when a character is typed inside it', () => {
    const next = `${text.slice(0, 15)}!${text.slice(15)}`
    expect(applyTextEdit(text, next, [mention])).toEqual([])
  })

  it('is a no-op for identical text', () => {
    expect(applyTextEdit(text, text, [mention])).toEqual([mention])
  })

  it('removes only the edited one of two identically named mentions', () => {
    const both = '@Abrar Ahmed and @Abrar Ahmed'
    const mentions: MentionRange[] = [
      { userId: 'u-abrar', label: 'Abrar Ahmed', start: 0, end: 12 },
      { userId: 'u-abrar2', label: 'Abrar Ahmed', start: 17, end: 29 },
    ]
    // Delete the FIRST token and the space after it.
    const first = applyTextEdit(both, 'and @Abrar Ahmed', mentions)
    expect(first).toHaveLength(1)
    expect(first[0].userId).toBe('u-abrar2')
    expect('and @Abrar Ahmed'.slice(first[0].start, first[0].end)).toBe(
      '@Abrar Ahmed',
    )
    // Delete the SECOND token instead.
    const second = applyTextEdit(both, '@Abrar Ahmed and ', mentions)
    expect(second.map(m => m.userId)).toEqual(['u-abrar'])
  })

  it('never keeps a mention whose text no longer matches its label', () => {
    // A range that has drifted (however it got there) is dropped, not trusted.
    const drifted: MentionRange = { ...mention, start: 10, end: 22 }
    expect(applyTextEdit(text, `${text}.`, [drifted])).toEqual([])
  })

  it('leaves a mention that has no place in the text untouched', () => {
    const floating: MentionRange = {
      userId: 'u-rachel',
      label: 'Rachel Smith',
      start: -1,
      end: -1,
    }
    expect(applyTextEdit('a', 'ab', [floating])).toEqual([floating])
  })
})

describe('removeMention', () => {
  it('removes the token and the space after it', () => {
    const text = 'ask @Araysh Khan about it'
    const mentions: MentionRange[] = [
      { userId: 'u-araysh', label: 'Araysh Khan', start: 4, end: 16 },
    ]
    const result = removeMention(text, mentions, 0)
    expect(result.text).toBe('ask about it')
    expect(result.mentions).toEqual([])
  })

  it('shifts the mentions after it', () => {
    const text = '@Araysh Khan and @Rachel Smith'
    const mentions: MentionRange[] = [
      { userId: 'u-araysh', label: 'Araysh Khan', start: 0, end: 12 },
      { userId: 'u-rachel', label: 'Rachel Smith', start: 17, end: 30 },
    ]
    const result = removeMention(text, mentions, 0)
    expect(result.text).toBe('and @Rachel Smith')
    expect(result.text.slice(result.mentions[0].start)).toBe('@Rachel Smith')
  })

  it('removes a mention that was never in the text without touching the text', () => {
    const floating: MentionRange = {
      userId: 'u-rachel',
      label: 'Rachel Smith',
      start: -1,
      end: -1,
    }
    expect(removeMention('unchanged', [floating], 0)).toEqual({
      text: 'unchanged',
      mentions: [],
    })
  })
})

describe('mentionedUserIds', () => {
  it('lists each person once, in order', () => {
    const mentions: MentionRange[] = [
      { userId: 'a', label: 'A', start: 0, end: 2 },
      { userId: 'b', label: 'B', start: 3, end: 5 },
      { userId: 'a', label: 'A', start: 6, end: 8 },
    ]
    expect(mentionedUserIds(mentions)).toEqual(['a', 'b'])
  })
})

describe('mentionsFromText', () => {
  it('finds each mentioned member in a saved reason', () => {
    const reason = 'Waiting on @Araysh Khan and @Rachel Smith.'
    const mentions = mentionsFromText(reason, [araysh, rachel])
    expect(mentions.map(m => m.userId)).toEqual(['u-araysh', 'u-rachel'])
    for (const m of mentions)
      expect(reason.slice(m.start, m.end)).toBe(`@${m.label}`)
  })

  it('gives two same-named members separate occurrences', () => {
    const reason = '@Abrar Ahmed then @Abrar Ahmed'
    const mentions = mentionsFromText(reason, [abrar, abrar2])
    expect(mentions.map(m => m.start)).toEqual([0, 18])
    expect(mentions.map(m => m.userId)).toEqual(['u-abrar', 'u-abrar2'])
  })

  it('keeps a member the text no longer names as a mention with no place in it', () => {
    const [found] = mentionsFromText('No names here', [araysh])
    expect(found).toMatchObject({ userId: 'u-araysh', start: -1, end: -1 })
  })
})
