import { describe, expect, it } from 'vitest'
import {
  decidePostLoginDestination,
  resolveRouteRedirect,
} from '@/lib/auth/routing'

const redirect = (pathname: string, query: string, isAuthenticated: boolean) =>
  resolveRouteRedirect({
    pathname,
    search: new URLSearchParams(query),
    isAuthenticated,
  })

describe('resolveRouteRedirect', () => {
  describe('/ (the guest page)', () => {
    it('leaves guests on the guest page', () => {
      expect(redirect('/', '', false)).toBeNull()
    })

    it('sends a signed-in user straight to their Personal Workspace', () => {
      expect(redirect('/', '', true)).toBe('/workspaces/personal-workspace')
    })

    it('sends an invitation link to /workspaces for a signed-in user, keeping its params', () => {
      expect(
        redirect('/', 'invite=abc&workspace=DevAbby&email=a%40b.co', true),
      ).toBe('/workspaces?invite=abc&workspace=DevAbby&email=a%40b.co')
    })

    it('does not redirect while an auth handshake is in flight', () => {
      expect(redirect('/', 'code=pkce-code', true)).toBeNull()
      expect(redirect('/', 'token_hash=xyz&type=recovery', true)).toBeNull()
      expect(redirect('/', 'error=access_denied', true)).toBeNull()
    })
  })

  describe('/workspaces', () => {
    it('lets signed-in users through', () => {
      expect(redirect('/workspaces', '', true)).toBeNull()
      expect(redirect('/workspaces/personal-workspace', '', true)).toBeNull()
      expect(redirect('/workspaces/acme/members', '', true)).toBeNull()
    })

    it('bounces guests to the sign-in prompt on /', () => {
      expect(redirect('/workspaces', '', false)).toBe('/?authIntent=workspaces')
      expect(redirect('/workspaces/personal-workspace', '', false)).toBe(
        '/?authIntent=workspaces',
      )
      expect(redirect('/workspaces/acme/settings', '', false)).toBe(
        '/?authIntent=workspaces',
      )
    })

    it('keeps an invitation link’s context when bouncing a guest', () => {
      const destination = redirect(
        '/workspaces',
        'invite=abc&workspace=DevAbby&email=a%40b.co',
        false,
      )
      const params = new URLSearchParams(destination!.split('?')[1])
      expect(destination!.startsWith('/?')).toBe(true)
      expect(params.get('invite')).toBe('abc')
      expect(params.get('workspace')).toBe('DevAbby')
      expect(params.get('email')).toBe('a@b.co')
      expect(params.get('authIntent')).toBe('workspaces')
    })

    it('does not treat lookalike paths as workspace routes', () => {
      expect(redirect('/workspaces-info', '', false)).toBeNull()
    })
  })

  it('ignores every other route', () => {
    expect(redirect('/api/cron/daily-reports', '', false)).toBeNull()
    expect(redirect('/some-other-page', '', true)).toBeNull()
  })
})

describe('decidePostLoginDestination', () => {
  it('first login with no invitation -> Personal Workspace', () => {
    expect(
      decidePostLoginDestination({
        personalWelcomeSeen: false,
        pendingInvitationCount: 0,
      }),
    ).toBe('/workspaces/personal-workspace')
  })

  it('first login WITH a pending invitation -> /workspaces, never straight to personal', () => {
    expect(
      decidePostLoginDestination({
        personalWelcomeSeen: false,
        pendingInvitationCount: 1,
      }),
    ).toBe('/workspaces')
  })

  it('returning user -> /workspaces', () => {
    expect(
      decidePostLoginDestination({
        personalWelcomeSeen: true,
        pendingInvitationCount: 0,
      }),
    ).toBe('/workspaces')
  })

  it('returning user with invitations -> /workspaces', () => {
    expect(
      decidePostLoginDestination({
        personalWelcomeSeen: true,
        pendingInvitationCount: 3,
      }),
    ).toBe('/workspaces')
  })
})
