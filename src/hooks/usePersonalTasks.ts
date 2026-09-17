import { useTasks } from '@/hooks/useTasks'
import { useCloudTasks } from '@/hooks/useCloudTasks'
import { Settings, Task } from '@/types'
import type { AuthUser } from '@/hooks/useAuth'

// Forks between the untouched guest/localStorage hook and the Supabase-backed
// one based on auth state. Both are called unconditionally every render
// (rules of hooks) — onComplete is only forwarded to whichever branch is
// actually active, so a stale guest task left over from before login can't
// pop the completion modal while cloud data is on screen.
export function usePersonalTasks(
  user: AuthUser | null,
  settings: Settings,
  onComplete?: (task: Task) => void,
) {
  const guest = useTasks(settings, user ? undefined : onComplete)
  const cloud = useCloudTasks(user, settings, user ? onComplete : undefined)
  return user ? cloud : { ...guest, error: null as string | null }
}
