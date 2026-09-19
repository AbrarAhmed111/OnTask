import type { User } from '@supabase/supabase-js'

export type AuthUser = {
  id: string
  email: string | null
  fullName: string | null
  avatarUrl: string | null
}

export function toAuthUser(user: User | null): AuthUser | null {
  if (!user) return null
  const metadata = user.user_metadata ?? {}
  return {
    id: user.id,
    email: user.email ?? null,
    fullName:
      (metadata.full_name as string | undefined) ||
      (metadata.name as string | undefined) ||
      null,
    avatarUrl: (metadata.avatar_url as string | undefined) || null,
  }
}
