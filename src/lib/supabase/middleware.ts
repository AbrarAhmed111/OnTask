import { createServerClient } from './server'
import { NextResponse, type NextRequest } from 'next/server'
import { get } from '@vercel/edge-config'

const AUTH_PAGES = ['/signin', '/signup', '/welcome', '/forget-password', '/reset-password']
const PROTECTED_PATHS = ['/dashboard', '/register']
const ADMIN_PATHS = ['/admin-panel']
const PUBLIC_PATHS = ['/', '/maintenance']

export async function updateSession(request: NextRequest) {
	const currentPath = request.nextUrl.pathname
	const hostname = request.headers.get('host') || ''
	const isVercelPreview = hostname.includes('.vercel.app')
	const previewAdminMode = request.nextUrl.searchParams.get('admin') === 'true'
	const isAdminSubdomain = hostname.startsWith('admin.') || (isVercelPreview && previewAdminMode)
	const supabase = await createServerClient()
	const supabaseResponse = NextResponse.next()

	// Fetch current user session
	const {
		data: { user },
		error: userError
	} = await supabase.auth.getUser()

	// Maintenance Mode (optional via Edge Config)
	try {
		const isMaintenanceMode = await get('maintenance')
		if (isMaintenanceMode && currentPath !== '/maintenance') {
			if (!user) {
				return NextResponse.rewrite(new URL('/maintenance', request.url))
			}

			// Only allow super_admin during maintenance
			const { data: userData } = await supabase
				.from('users')
				.select('role')
				.eq('auth_id', user.id)
				.single()

			if (userData?.role !== 'super_admin') {
				return NextResponse.rewrite(new URL('/maintenance', request.url))
			}
		}
	} catch {
		// best-effort maintenance check
	}

	const isAuthPage = AUTH_PAGES.some(path => currentPath.startsWith(path))
	const isProtectedPath = PROTECTED_PATHS.some(path => currentPath.startsWith(path))
	const isAdminPath = ADMIN_PATHS.some(path => currentPath.startsWith(path))
	const isPublicPath = PUBLIC_PATHS.includes(currentPath)

	// Handle authenticated users
	if (user && !userError) {
		// Redirect authenticated users away from auth pages
		if ((isAuthPage || currentPath === '/') && !isAdminPath) {
			const returnUrl = request.nextUrl.searchParams.get('returnUrl')
			if (returnUrl) {
				try {
					const url = new URL(returnUrl, request.nextUrl.origin)
					if (url.origin === request.nextUrl.origin) return NextResponse.redirect(url)
				} catch {
					// ignore invalid returnUrl
				}
			}
			const redirectPath = isAdminSubdomain ? '/admin-panel' : '/dashboard'
			return NextResponse.redirect(new URL(redirectPath, request.url))
		}

		// Allow access to protected paths
		return supabaseResponse
	}

	// Handle unauthenticated users
	if (!user || userError) {
		// Allow access to auth pages and public paths
		if (isAuthPage || isPublicPath) return supabaseResponse

		// Redirect to welcome page for protected/admin paths
		if (isProtectedPath || isAdminPath) {
			const welcomeUrl = new URL('/welcome', request.url)
			if (currentPath !== '/dashboard') {
				welcomeUrl.searchParams.set('returnUrl', request.url)
			}
			return NextResponse.redirect(welcomeUrl)
		}

		// Allow other paths (public content)
		return supabaseResponse
	}

	return supabaseResponse
}


