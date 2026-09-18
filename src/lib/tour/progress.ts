import { createClient } from '@/lib/supabase/client'
import type { TourId, TourOutcome } from '@/lib/tour/types'

// Which tours a user has already finished or skipped, per workspace: one row
// per (user, workspace, tour) in user_tour_progress (migration 0039). It lives
// in Supabase rather than the browser so a tour doesn't come back on another
// device or after site data is cleared, and it is per workspace because every
// workspace has its own layout and its own people.
//
// A person's Personal Workspace is an ordinary workspace row, so the personal
// tour is stored the same way -- keyed by that workspace -- with no separate
// per-user mechanism.

// null: never finished or skipped, so the tour is due. Throws when the lookup
// itself fails (offline, migration not applied); callers treat that as "not
// due" so a broken lookup can never nag someone on every page load.
export async function fetchTourOutcome(
  userId: string,
  workspaceId: string,
  tourId: TourId,
): Promise<TourOutcome | null> {
  const { data, error } = await createClient()
    .from('user_tour_progress')
    .select('outcome')
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .eq('tour_id', tourId)
    .maybeSingle()
  if (error) throw error
  return (data?.outcome as TourOutcome | undefined) ?? null
}

// Replaying a tour that was completed before and skipping it this time simply
// overwrites the row.
export async function saveTourOutcome(
  userId: string,
  workspaceId: string,
  tourId: TourId,
  outcome: TourOutcome,
): Promise<void> {
  const { error } = await createClient().from('user_tour_progress').upsert(
    {
      user_id: userId,
      workspace_id: workspaceId,
      tour_id: tourId,
      outcome,
    },
    { onConflict: 'user_id,workspace_id,tour_id' },
  )
  if (error) throw error
}
