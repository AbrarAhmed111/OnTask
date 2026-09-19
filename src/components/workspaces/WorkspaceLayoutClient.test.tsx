import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Provider } from 'react-redux'
import { WorkspaceLayout } from '@/components/workspaces/WorkspaceLayoutClient'
import { makeStore } from '@/lib/redux/store'
import {
  CachedWorkspaceIdentity,
  upsertPersonalWorkspaceIdentity,
  upsertWorkspaceIdentity,
} from '@/lib/redux/workspaceCacheSlice'
import { PERSONAL_WORKSPACE_SLUG } from '@/lib/workspaces'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, replace: () => {} }),
  usePathname: () => '/workspaces/design-team',
}))

const user = {
  id: 'user-a',
  email: 'a@example.com',
  fullName: 'Abrar',
  avatarUrl: null,
}

const identity = (
  overrides: Partial<CachedWorkspaceIdentity> = {},
): CachedWorkspaceIdentity => ({
  id: 'ws-1',
  slug: 'design-team',
  name: 'Design Team',
  accent: 'berry',
  timezone: 'Europe/London',
  ...overrides,
})

const BERRY = '--ws-accent:#8b3a6b'
const OCEAN = '--ws-accent:#2b6cb0'
const FOREST = '--ws-accent:#375b4b'

// The first client render after sign-in, before the workspace row has loaded:
// every data hook is still empty (their fetches run in effects, which a
// server render never runs), so what paints is decided by the two identity
// sources alone.
function firstPaint({
  slug = 'design-team',
  initialIdentity,
  cached,
  cachedPersonal,
}: {
  slug?: string
  initialIdentity?: CachedWorkspaceIdentity
  cached?: CachedWorkspaceIdentity
  cachedPersonal?: CachedWorkspaceIdentity
}) {
  const store = makeStore()
  if (cached) store.dispatch(upsertWorkspaceIdentity(cached))
  if (cachedPersonal) {
    store.dispatch(
      upsertPersonalWorkspaceIdentity({
        ownerId: user.id,
        identity: cachedPersonal,
      }),
    )
  }
  return renderToStaticMarkup(
    <Provider store={store}>
      <WorkspaceLayout
        workspaceSlug={slug}
        initialIdentity={initialIdentity}
        user={user}
        onLogout={() => {}}
      >
        <p>page</p>
      </WorkspaceLayout>
    </Provider>,
  )
}

describe('the workspace layout, before the workspace row has loaded', () => {
  it('paints the accent the server read on a browser that has never opened the workspace', () => {
    const html = firstPaint({ initialIdentity: identity({ accent: 'berry' }) })

    expect(html).toContain(BERRY)
    expect(html).not.toContain(FOREST)
    // ... and its name, instead of a loading skeleton.
    expect(html).toContain('Design Team')
  })

  it('prefers the server over a cache left stale by a change made on another device', () => {
    const html = firstPaint({
      initialIdentity: identity({ accent: 'berry' }),
      cached: identity({ accent: 'ocean' }),
    })

    expect(html).toContain(BERRY)
    expect(html).not.toContain(OCEAN)
  })

  it("falls back to this browser's cache when the server couldn't read the workspace", () => {
    const html = firstPaint({ cached: identity({ accent: 'ocean' }) })

    expect(html).toContain(OCEAN)
  })

  it('uses the default accent when nothing is known yet', () => {
    expect(firstPaint({})).toContain(FOREST)
  })

  it('prefers the server for the Personal Workspace too, over the cache for this account', () => {
    const html = firstPaint({
      slug: PERSONAL_WORKSPACE_SLUG,
      initialIdentity: identity({
        id: 'ws-personal',
        slug: PERSONAL_WORKSPACE_SLUG,
        accent: 'berry',
      }),
      cachedPersonal: identity({
        id: 'ws-personal',
        slug: PERSONAL_WORKSPACE_SLUG,
        accent: 'rose',
      }),
    })

    expect(html).toContain(BERRY)
  })

  it('sets the accent once, on the outermost element, so the dialogs beside the shell inherit it', () => {
    // Regression: the invite, welcome and guest-work dialogs are rendered by
    // the layout next to the shell, not inside it. They used to sit outside
    // the accent's scope and showed the default forest on every workspace
    // that had picked another accent. Anything the layout renders is now
    // beneath the one scope, and nothing sets the accent a second time.
    const html = firstPaint({ initialIdentity: identity({ accent: 'berry' }) })

    expect(html.startsWith(`<div style="${BERRY};`)).toBe(true)
    expect(html.split('--ws-accent:')).toHaveLength(2)
  })
})
