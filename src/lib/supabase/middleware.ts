import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { resolveRouteRedirect } from '@/lib/auth/routing'

// Refreshes the Supabase session cookie on every request so server
// components/actions always see current auth state, and enforces the two
// auth-based routing rules that must not depend on client-side JS:
//
//   - a signed-in user visiting `/` never sees the guest page
//   - a signed-out visitor never reaches `/workspaces/**`
//
// (the rules themselves live in lib/auth/routing.ts). This is a routing
// convenience layered ON TOP of the real access control, which is Postgres
// row-level security: a URL can send someone to a page, but only their own
// session's RLS decides what data that page can load.
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Do not add logic between createServerClient and auth.getUser() — this
  // call is what actually refreshes the session token, and anything in
  // between risks skipping it on early return.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const destination = resolveRouteRedirect({
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.searchParams,
    isAuthenticated: Boolean(user),
  })
  if (!destination) return supabaseResponse

  const redirect = NextResponse.redirect(new URL(destination, request.url))
  // Carry any refreshed session cookies over to the redirect response, or the
  // refreshed token would be lost on the hop.
  supabaseResponse.cookies
    .getAll()
    .forEach(cookie => redirect.cookies.set(cookie))
  return redirect
}
