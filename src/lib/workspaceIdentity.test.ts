import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadWorkspaceIdentity } from '@/lib/workspaceIdentity'
import { PERSONAL_WORKSPACE_SLUG, WorkspaceRow } from '@/lib/workspaces'

const row = (overrides: Partial<WorkspaceRow> = {}): WorkspaceRow => ({
  id: 'ws-1',
  slug: 'design-team',
  type: 'shared',
  name: 'Design Team',
  description: 'Private notes about the team',
  owner_id: 'user-a',
  timezone: 'Europe/London',
  report_time: '12:00:00',
  accent: 'berry',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
  ...overrides,
})

type Call = [string, ...unknown[]]

// Records the query the loader builds and answers it, so a test can say both
// what was asked ("by slug", "by verified owner") and what came back.
function fakeSupabase({
  data = null,
  error = null,
  claims = { sub: 'user-a' },
  claimsThrow = false,
  queryThrows = false,
}: {
  data?: WorkspaceRow | null
  error?: { message: string } | null
  claims?: { sub: string } | null
  claimsThrow?: boolean
  queryThrows?: boolean
} = {}) {
  const calls: Call[] = []
  const query = {
    select: (...args: unknown[]) => (calls.push(['select', ...args]), query),
    eq: (...args: unknown[]) => (calls.push(['eq', ...args]), query),
    maybeSingle: async () => {
      calls.push(['maybeSingle'])
      if (queryThrows) throw new Error('network down')
      return { data, error }
    },
  }
  const supabase = {
    from: (table: string) => (calls.push(['from', table]), query),
    auth: {
      getClaims: async () => {
        calls.push(['getClaims'])
        if (claimsThrow) throw new Error('auth down')
        return { data: claims ? { claims } : null, error: null }
      },
    },
  } as unknown as SupabaseClient
  return { supabase, calls }
}

const eqs = (calls: Call[]) =>
  calls.filter(call => call[0] === 'eq').map(call => call.slice(1))

describe('loadWorkspaceIdentity', () => {
  it('reads a shared workspace by its slug, without needing to know who is asking', async () => {
    const { supabase, calls } = fakeSupabase({ data: row() })

    const identity = await loadWorkspaceIdentity(supabase, 'design-team')

    expect(identity).toEqual({
      id: 'ws-1',
      slug: 'design-team',
      name: 'Design Team',
      accent: 'berry',
      timezone: 'Europe/London',
    })
    expect(eqs(calls)).toEqual([['slug', 'design-team']])
    expect(calls.some(call => call[0] === 'getClaims')).toBe(false)
  })

  it('finds the personal workspace by the verified signed-in owner, never by the shared alias', async () => {
    const { supabase, calls } = fakeSupabase({
      data: row({ type: 'personal', slug: 'personal-8f3a91', name: 'Me' }),
      claims: { sub: 'user-a' },
    })

    const identity = await loadWorkspaceIdentity(
      supabase,
      PERSONAL_WORKSPACE_SLUG,
    )

    expect(eqs(calls)).toEqual([
      ['type', 'personal'],
      ['owner_id', 'user-a'],
    ])
    // Reported under the reserved alias, as everywhere else in the app.
    expect(identity?.slug).toBe(PERSONAL_WORKSPACE_SLUG)
    expect(identity?.accent).toBe('berry')
  })

  it('does not read a personal workspace it cannot tie to a verified user', async () => {
    const { supabase, calls } = fakeSupabase({
      data: row({ type: 'personal' }),
      claims: null,
    })

    expect(
      await loadWorkspaceIdentity(supabase, PERSONAL_WORKSPACE_SLUG),
    ).toBeUndefined()
    expect(calls.some(call => call[0] === 'maybeSingle')).toBe(false)
  })

  it('carries only the identity fields, never the rest of the workspace', async () => {
    const { supabase } = fakeSupabase({ data: row() })

    const identity = await loadWorkspaceIdentity(supabase, 'design-team')

    expect(Object.keys(identity ?? {}).sort()).toEqual([
      'accent',
      'id',
      'name',
      'slug',
      'timezone',
    ])
  })

  it('gives nothing when the workspace is not visible to the caller', async () => {
    const { supabase } = fakeSupabase({ data: null })

    expect(await loadWorkspaceIdentity(supabase, 'not-mine')).toBeUndefined()
  })

  it('gives nothing when the query fails', async () => {
    const { supabase } = fakeSupabase({
      data: row(),
      error: { message: 'permission denied' },
    })

    expect(await loadWorkspaceIdentity(supabase, 'design-team')).toBeUndefined()
  })

  it('never throws -- a paint hint must not be able to break the page', async () => {
    expect(
      await loadWorkspaceIdentity(
        fakeSupabase({ queryThrows: true }).supabase,
        'design-team',
      ),
    ).toBeUndefined()
    expect(
      await loadWorkspaceIdentity(
        fakeSupabase({ claimsThrow: true }).supabase,
        PERSONAL_WORKSPACE_SLUG,
      ),
    ).toBeUndefined()
  })
})
