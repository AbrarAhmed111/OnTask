'use server'

import { createClient } from '@/lib/supabase/server'

// Helper to get the current user (Server Components / Route Handlers).
// Returns null when signed out — callers gate UI on the result rather than
// redirecting, since OnTask has no dedicated auth/protected routes.
export async function getCurrentUser() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}
