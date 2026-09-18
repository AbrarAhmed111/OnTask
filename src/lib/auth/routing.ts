import { PERSONAL_WORKSPACE_PATH } from '@/lib/workspaces'

// Pure routing decisions, kept free of Next/Supabase imports so the rules can
// be unit-tested and shared between the server (middleware) and the client
// (post-sign-in redirect).

export const WORKSPACES_PATH = '/workspaces'

// Query params that mean "an auth handshake is in flight on this URL" —
// Supabase's browser client is about to exchange them for a session, so
// redirecting away now would throw the code/token away.
const AUTH_HANDSHAKE_PARAMS = ['code', 'token_hash', 'error', 'error_code']

export type RouteRedirectInput = {
  pathname: string
  search: URLSearchParams
  isAuthenticated: boolean
}

// Server-side gate (middleware). Returns the path (+ query string) to
// redirect to, or null to let the request through.
//
//   /                  signed in  -> the Personal Workspace
//                                    (the guest page is only for guests)
//   /?invite=...       signed in  -> /workspaces, keeping the invite params
//                                    (an invitation must be answered, not
//                                    skipped past on the way to personal)
//   /workspaces/**     signed out -> / with an auth prompt, params preserved
//                                    (invitation links keep their context)
export function resolveRouteRedirect({
  pathname,
  search,
  isAuthenticated,
}: RouteRedirectInput): string | null {
  if (pathname === '/' && isAuthenticated) {
    if (AUTH_HANDSHAKE_PARAMS.some(param => search.has(param))) return null
    if (search.has('invite')) {
      const query = search.toString()
      return query ? `${WORKSPACES_PATH}?${query}` : WORKSPACES_PATH
    }
    return PERSONAL_WORKSPACE_PATH
  }

  if (
    !isAuthenticated &&
    (pathname === WORKSPACES_PATH || pathname.startsWith(`${WORKSPACES_PATH}/`))
  ) {
    const params = new URLSearchParams(search)
    params.set('authIntent', 'workspaces')
    return `/?${params.toString()}`
  }

  return null
}

export type PostLoginState = {
  // Has this user been shown the one-time Personal Workspace welcome yet?
  // `false` means this is their first login.
  personalWelcomeSeen: boolean
  pendingInvitationCount: number
}

// Where a user lands right after signing in or signing up.
//
//   pending invitation(s)            -> /workspaces (first login or not):
//                                       the invitation must be answered
//                                       explicitly, never auto-accepted and
//                                       never skipped past
//   first login, no invitations      -> their Personal Workspace (+ welcome)
//   returning user                   -> /workspaces, their hub
export function decidePostLoginDestination(state: PostLoginState): string {
  if (state.pendingInvitationCount > 0) return WORKSPACES_PATH
  if (!state.personalWelcomeSeen) return PERSONAL_WORKSPACE_PATH
  return WORKSPACES_PATH
}
