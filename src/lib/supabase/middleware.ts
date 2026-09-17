import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Refreshes the Supabase session cookie on every request so server
// components/actions always see current auth state. OnTask has no
// route-level auth guards to enforce here — the whole app lives on `/`,
// and authenticated features are gated in the UI (modal-only), not by
// redirecting between pages.
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
  await supabase.auth.getUser()

  return supabaseResponse
}
