'use server'

import {
	createServerClient as createSupabaseClient,
	type CookieOptions
} from '@supabase/ssr'
import { cookies, type UnsafeUnwrappedCookies } from 'next/headers'

// Server Component client - safe to call per request
export async function createClient() {
	const rawCookies = await cookies()
	const cookieStore = rawCookies as UnsafeUnwrappedCookies

	return createSupabaseClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
		{
			auth: {
				persistSession: true,
				autoRefreshToken: true,
				detectSessionInUrl: true,
				flowType: 'pkce'
			},
			cookies: {
				getAll() {
					return cookieStore.getAll()
				},
				setAll(cookiesToSet) {
					try {
						cookiesToSet.forEach(({ name, value, options }) => {
							// Production-safe cookie options
							const cookieOptions: CookieOptions = {
								...options,
								domain: undefined,
								secure: process.env.NODE_ENV === 'production',
								sameSite: 'lax'
							}
							// @ts-expect-error - next types don't allow CookieOptions here but runtime supports it
							cookieStore.set(name, value, cookieOptions)
						})
					} catch (error) {
						// The setAll method can be called from Server Components; safe to ignore in that case.
						console.warn('Cookie setting failed in server component:', error)
					}
				}
			}
		}
	)
}

export const createServerClient = createClient


