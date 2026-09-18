'use client'

import { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import type { AuthUser } from '@/hooks/useAuth'
import { PERSONAL_WORKSPACE_PATH } from '@/lib/workspaces'

// Shared chrome for the /workspaces hub. Signed-out visitors never get this
// far (the middleware sends them to the sign-in prompt on `/`; the guard
// below is the client-side backstop), so by the time this shell's content is
// shown, `user` is guaranteed non-null.
export function WorkspacePageShell({
  notice,
  onDismissNotice,
  children,
}: {
  notice?: string
  onDismissNotice?: () => void
  children: (context: { user: AuthUser }) => ReactNode
}) {
  const { user, ready, handleLogout } = useAuthGuard()
  const router = useRouter()

  if (!ready || !user) {
    return <main className="min-h-screen bg-paper" />
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_80%_0%,#e4f0e6_0,transparent_30%),linear-gradient(135deg,#f8faf7_0%,#eff3ee_100%)] text-ink">
      <Header
        user={user}
        authReady={ready}
        onOpenAuth={() => {}}
        onOpenWorkspaces={() => router.push(PERSONAL_WORKSPACE_PATH)}
        onLogout={handleLogout}
        context="workspaces"
        homeHref="/workspaces"
        homeLabel="Go to your workspaces"
      />
      <div className="mx-auto w-[min(1120px,calc(100%-32px))] pb-16 pt-10">
        {notice && (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-sage/40 bg-sage/10 px-4 py-3 text-xs text-forest animate-[fadeIn_180ms_ease-out]">
            <Check size={16} />
            <span>{notice}</span>
            {onDismissNotice && (
              <button
                className="ml-auto text-forest/60 hover:text-forest"
                onClick={onDismissNotice}
              >
                Dismiss
              </button>
            )}
          </div>
        )}
        {children({ user })}
      </div>
      <Footer />
    </main>
  )
}
