import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service'

// The automatic Daily Report scheduler's entry point. Invoked every 5
// minutes by Supabase pg_cron/pg_net (see the `daily-reports-tick` job in
// supabase/migrations/0018_automatic_daily_reports.sql) -- never by a
// browser, and never on a timer running in the browser (setInterval etc
// would stop the moment nobody has the app open, which is exactly what this
// feature must not depend on). Runs with service-role privileges (bypasses
// RLS) but every RPC it calls stays scoped to one explicit workspace_id at a
// time, so it can never mix data across workspaces.
//
// Idempotency/concurrency is owned entirely by claim_daily_report's atomic
// INSERT ... ON CONFLICT ... WHERE <retryable> -- this route can safely run
// concurrently with itself (overlapping ticks, retried pg_net deliveries)
// without ever producing two reports for the same (workspace_id, report_end).
export const maxDuration = 60 // Vercel: allow enough time to process several due workspaces per tick.

const ONTASK_LLM_TIMEOUT_MS = 45_000
const CONCURRENCY = 3

type DueWorkspace = {
  workspace_id: string
  workspace_name: string
  timezone: string
  report_start: string
  report_end: string
}

async function processCandidate(
  supabase: ReturnType<typeof createServiceRoleClient>,
  serviceUrl: string,
  candidate: DueWorkspace,
): Promise<'completed' | 'failed' | 'skipped'> {
  const { data: claimed, error: claimError } = await supabase.rpc(
    'claim_daily_report',
    {
      p_workspace_id: candidate.workspace_id,
      p_report_start: candidate.report_start,
      p_report_end: candidate.report_end,
      p_timezone: candidate.timezone,
    },
  )
  if (claimError) {
    console.error(
      `[daily-reports] claim failed for workspace ${candidate.workspace_id}:`,
      claimError,
    )
    return 'skipped'
  }
  if (!claimed) {
    // Already completed, actively pending elsewhere, or permanently failed
    // (max retries) -- another worker has this one, or it's settled.
    return 'skipped'
  }

  try {
    const { data: snapshot, error: snapshotError } = await supabase.rpc(
      'generate_workspace_daily_snapshot',
      {
        p_workspace_id: candidate.workspace_id,
        p_report_start: candidate.report_start,
        p_report_end: candidate.report_end,
        p_timezone: candidate.timezone,
      },
    )
    if (snapshotError || !snapshot) {
      throw new Error(
        snapshotError?.message || 'Failed to aggregate workspace activity',
      )
    }

    const response = await fetch(`${serviceUrl}/api/summary/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ snapshot }),
      signal: AbortSignal.timeout(ONTASK_LLM_TIMEOUT_MS),
    })
    if (!response.ok) {
      throw new Error(`ontask-llm responded ${response.status}`)
    }
    const { narrative, meta } = await response.json()

    const { error: finishError } = await supabase.rpc('finish_daily_report', {
      p_workspace_id: candidate.workspace_id,
      p_report_end: candidate.report_end,
      p_structured_snapshot: snapshot,
      p_narrative: narrative,
      p_meta: meta,
    })
    if (finishError) throw new Error(finishError.message)

    return 'completed'
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : 'Unknown error generating the Daily Report'
    console.error(
      `[daily-reports] generation failed for workspace ${candidate.workspace_id}:`,
      err,
    )
    await supabase.rpc('fail_daily_report', {
      p_workspace_id: candidate.workspace_id,
      p_report_end: candidate.report_end,
      p_error_message: message,
    })
    return 'failed'
  }
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('CRON_SECRET is not configured')
    return NextResponse.json(
      { error: 'Cron endpoint is not configured' },
      { status: 500 },
    )
  }
  if (request.headers.get('x-cron-secret') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const serviceUrl = process.env.ONTASK_LLM_SERVICE_URL
  if (!serviceUrl) {
    console.error('ONTASK_LLM_SERVICE_URL is not configured')
    return NextResponse.json(
      { error: 'AI summary service is not configured' },
      { status: 500 },
    )
  }

  const supabase = createServiceRoleClient()

  const { data: due, error: dueError } = await supabase.rpc(
    'list_workspaces_due_for_daily_report',
  )
  if (dueError) {
    console.error('[daily-reports] failed to list due workspaces:', dueError)
    return NextResponse.json(
      { error: 'Failed to list due workspaces' },
      { status: 500 },
    )
  }

  const candidates = (due ?? []) as DueWorkspace[]
  const outcomes: Record<'completed' | 'failed' | 'skipped', number> = {
    completed: 0,
    failed: 0,
    skipped: 0,
  }

  for (let i = 0; i < candidates.length; i += CONCURRENCY) {
    const batch = candidates.slice(i, i + CONCURRENCY)
    const results = await Promise.all(
      batch.map(candidate => processCandidate(supabase, serviceUrl, candidate)),
    )
    for (const outcome of results) outcomes[outcome] += 1
  }

  return NextResponse.json({ due: candidates.length, ...outcomes })
}
