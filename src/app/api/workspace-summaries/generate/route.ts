import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Orchestrates Phase 10 generation: build the structured snapshot (RPC,
// membership-checked server-side), call the ontask-llm service for a
// validated narrative, then persist both atomically. This route owns
// everything ontask-llm deliberately doesn't (it's stateless) — idempotency,
// the one-summary-per-day constraint, and regeneration semantics (10.3).
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const workspaceId = body?.workspaceId
  const summaryDate = body?.summaryDate
  const mode = body?.mode === 'regenerate' ? 'regenerate' : 'generate'

  if (typeof workspaceId !== 'string' || !workspaceId) {
    return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 })
  }
  if (
    typeof summaryDate !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(summaryDate)
  ) {
    return NextResponse.json(
      { error: 'Missing or invalid summaryDate' },
      { status: 400 },
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // "generate" (not "regenerate") never overwrites -- if today's summary
  // already exists, hand it back without spending an AI call at all (10.3).
  if (mode === 'generate') {
    const { data: existing } = await supabase
      .from('workspace_daily_summaries')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('summary_date', summaryDate)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ summary: existing })
    }
  }

  const { data: snapshot, error: snapshotError } = await supabase.rpc(
    'generate_workspace_daily_snapshot',
    { p_workspace_id: workspaceId, p_summary_date: summaryDate },
  )
  if (snapshotError || !snapshot) {
    const notMember = snapshotError?.message?.includes('not a member')
    return NextResponse.json(
      {
        error: notMember
          ? 'Not a member of this workspace'
          : 'Failed to aggregate activity for this day',
      },
      { status: notMember ? 403 : 500 },
    )
  }

  const serviceUrl = process.env.ONTASK_LLM_SERVICE_URL
  if (!serviceUrl) {
    console.error('ONTASK_LLM_SERVICE_URL is not configured')
    return NextResponse.json(
      { error: 'AI summary service is not configured' },
      { status: 500 },
    )
  }

  let narrative: unknown
  let meta: unknown
  try {
    const response = await fetch(`${serviceUrl}/api/summary/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ snapshot }),
      signal: AbortSignal.timeout(45_000),
    })
    if (!response.ok) {
      throw new Error(`ontask-llm responded ${response.status}`)
    }
    const data = await response.json()
    narrative = data.narrative
    meta = data.meta
  } catch (err) {
    console.error('Failed to generate AI summary:', err)
    return NextResponse.json(
      { error: 'The AI summary service is unavailable. Try again shortly.' },
      { status: 502 },
    )
  }

  const { data: saved, error: upsertError } = await supabase.rpc(
    'upsert_workspace_daily_summary',
    {
      p_workspace_id: workspaceId,
      p_summary_date: summaryDate,
      p_structured_snapshot: snapshot,
      p_narrative: narrative,
      p_meta: meta,
      p_mode: mode,
    },
  )
  if (upsertError || !saved) {
    return NextResponse.json(
      { error: upsertError?.message || 'Failed to save the summary' },
      { status: 500 },
    )
  }

  return NextResponse.json({ summary: saved })
}
