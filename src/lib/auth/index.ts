'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Helper to get current user (Server Components)
export async function getCurrentUser() {
	const supabase = await createClient()
	const {
		data: { user },
		error
	} = await supabase.auth.getUser()
	if (error || !user) return null
	return user
}

// Require authentication (Server Components)
export async function requireAuth() {
	const user = await getCurrentUser()
	if (!user) {
		redirect('/signin')
	}
	return user
}


