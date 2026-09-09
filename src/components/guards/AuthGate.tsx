'use client'

import { useEffect, useState, ReactNode } from 'react'
import { useRouter } from 'next/navigation'

interface AuthGateProps {
	children: ReactNode
	fallback?: ReactNode
	loading?: ReactNode
	redirectTo?: string
}

export function AuthGate({
	children,
	fallback = null,
	loading = <div className="p-6 text-center">Checking session...</div>,
	redirectTo = '/signin'
}: AuthGateProps) {
	const router = useRouter()
	const [status, setStatus] = useState<'checking' | 'authed' | 'denied'>('checking')

	useEffect(() => {
		let isMounted = true
		async function check() {
			try {
				const { createClient } = await import('@/lib/supabase/client')
				const supabase = createClient()
				const {
					data: { user }
				} = await supabase.auth.getUser()
				if (!isMounted) return
				if (user) {
					setStatus('authed')
				} else {
					setStatus('denied')
					router.replace(redirectTo)
				}
			} catch (e) {
				console.error('AuthGate error:', e)
				if (!isMounted) return
				setStatus('denied')
				router.replace(redirectTo)
			}
		}
		check()
		return () => {
			isMounted = false
		}
	}, [router, redirectTo])

	if (status === 'checking') return <>{loading}</>
	if (status === 'denied') return <>{fallback}</>
	return <>{children}</>
}


