'use client'

import { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import type { AuthUser } from '@/hooks/useAuth'
import { useMyInvitations } from '@/hooks/useMyInvitations'

// Shared chrome for every /workspaces route. Guests are redirected home
// (where the header's "Shared Workspaces" button opens the sign-in modal)
// rather than this shell rendering its own auth modal — by the time this
// shell's content is shown, `user` is already guaranteed non-null, so a
// modal trigger here would never actually be reachable.
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
  const { invitations } = useMyInvitations(user)
  const router = useRouter()

  if (!ready || !user) {
    return <main className="min-h-screen bg-paper" />
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_80%_0%,#e4f0e6_0,transparent_30%),linear-gradient(135deg,#f8faf7_0%,#eff3ee_100%)] text-ink">
      <Header
        onSettings={() => router.push('/')}
        user={user}
        authReady={ready}
        onOpenAuth={() => {}}
        onOpenWorkspaces={() => router.push('/')}
        onLogout={handleLogout}
        pendingInvitationCount={invitations.length}
        context="workspaces"
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
