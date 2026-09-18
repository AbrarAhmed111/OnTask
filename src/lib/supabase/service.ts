import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Service-role client: bypasses RLS entirely, used ONLY by the automatic
// Daily Report scheduler (src/app/api/cron/daily-reports/route.ts) to read
// across every workspace and call the service_role-only RPCs
// (list_workspaces_due_for_daily_report / claim_daily_report /
// finish_daily_report / fail_daily_report) defined in
// supabase/migrations/0018_automatic_daily_reports.sql. Never import this
// from anything reachable by a browser request on a normal user's behalf --
// every other route continues to use src/lib/supabase/server.ts's
// session-scoped client, which stays subject to RLS as before.
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_URL) is not configured',
    )
  }
  return createSupabaseClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
