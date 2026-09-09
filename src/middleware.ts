import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
	const { pathname, searchParams } = request.nextUrl
	const hostname = request.headers.get('host') || ''
	// Check if request is from admin subdomain or preview
	const isVercelPreview = hostname.includes('.vercel.app')
	const previewAdminMode = searchParams.get('admin') === 'true'
	const isAdminSubdomain = hostname.startsWith('admin.') || (isVercelPreview && previewAdminMode)

	// Define auth pages that should work on admin subdomain
	const authPages = ['/signin', '/signup', '/welcome', '/forget-password', '/reset-password']
	const isAuthPage = authPages.some(page => pathname.startsWith(page))

	// Handle admin subdomain routing
	if (isAdminSubdomain) {
		// Allow auth pages on admin subdomain
		if (isAuthPage) {
			return await updateSession(request)
		}

		// Redirect dashboard routes to admin-panel when on admin subdomain
		if (pathname.startsWith('/dashboard')) {
			return NextResponse.redirect(new URL('/admin-panel', request.url))
		}

		// Only allow admin routes on admin subdomain
		if (
			!pathname.startsWith('/admin-panel') &&
			!pathname.startsWith('/admin') &&
			!pathname.startsWith('/crm')
		) {
			return NextResponse.redirect(new URL('/admin-panel', request.url))
		}
	} else {
		// Not on admin subdomain - block direct access to admin routes
		if (
			pathname.startsWith('/admin-panel') ||
			pathname.startsWith('/admin') ||
			pathname.startsWith('/crm')
		) {
			return NextResponse.redirect(new URL('/', request.url))
		}
	}

	// Always update Supabase session
	return await updateSession(request)
}

export const config = {
	matcher: [
		/*
		 * Match all request paths except for the ones starting with:
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - favicon.ico (favicon file)
		 * - api/auth (auth API routes)
		 */
		'/((?!_next/static|_next/image|favicon.ico|api/auth|public).*)'
	]
}


