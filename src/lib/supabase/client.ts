'use client'

import { createBrowserClient } from '@supabase/ssr'

// Browser client - lightweight and safe to call multiple times
export function createClient() {
	return createBrowserClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
	)
}


