'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useWorkspaceSnapshot } from '@/hooks/useWorkspaceSnapshot'
import { useFetchStatus } from '@/hooks/useFetchStatus'
import { SNAPSHOTS } from '@/lib/cache/workspaceSnapshots'
import {
  formatTimeOfDay,
  isLocalToday,
  nextReportTime,
  parseTimeOfDay,
} from '@/lib/dailyReportWindow'
import type { AuthUser } from '@/hooks/useAuth'
import { WorkspaceDailySummary } from '@/types/workspace'

type SummaryRow = {
  id: string
  workspace_id: string
  report_start: string
  report_end: string
  report_timezone: string
  version: number
  structured_snapshot: WorkspaceDailySummary['structuredSnapshot']
  narrative: WorkspaceDailySummary['narrative']
  meta: WorkspaceDailySummary['meta']
  generation_type: WorkspaceDailySummary['generationType']
  generation_status: WorkspaceDailySummary['generationStatus']
  generated_by: string | null
  generated_at: string
  regenerated_by: string | null
  regenerated_at: string | null
  created_at: string
}

function rowToSummary(row: SummaryRow): WorkspaceDailySummary {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    reportStart: row.report_start,
    reportEnd: row.report_end,
    reportTimezone: row.report_timezone,
    version: row.version,
    structuredSnapshot: row.structured_snapshot,
    narrative: row.narrative,
    meta: row.meta,
    generationType: row.generation_type,
    generationStatus: row.generation_status,
    generatedBy: row.generated_by,
    generatedAt: row.generated_at,
    regeneratedBy: row.regenerated_by,
    regeneratedAt: row.regenerated_at,
    createdAt: row.created_at,
  }
}

const HISTORY_LIMIT = 14
const NO_HISTORY: WorkspaceDailySummary[] = []

// Fetches the workspace's Daily Reports (most recent first), live-synced via
// postgres_changes. Reports are created server-side by the automatic
// scheduler (supabase/migrations/0018_automatic_daily_reports.sql's
// daily-reports-tick cron job, via src/app/api/cron/daily-reports) -- this
// hook never creates one, it only displays what already exists and exposes
// `regenerate` as a secondary action on the current report.
export function useWorkspaceSummary(
  workspaceId: string,
  user: AuthUser | null,
  timezone: string,
  reportTime: string,
  // Whether the workspace has Daily Reports switched on. When it hasn't, the
  // section isn't shown at all, so there is nothing to load or keep live.
  enabled = true,
) {
  const userId = user?.id
  // The recent reports (at most HISTORY_LIMIT) are cached per user AND workspace
  // and shown while the real list is fetched. Off means nothing is read, shown
  // or kept live, exactly as before.
  const snapshot = useWorkspaceSnapshot<WorkspaceDailySummary[]>({
    userId: enabled ? userId : null,
    workspaceId,
    descriptor: SNAPSHOTS.summaries,
    initial: NO_HISTORY,
  })
  const { data: history, setData: setHistory, confirm } = snapshot
  // Only regenerating can fail visibly (it is what the section's banner shows);
  // a failed background load keeps whatever is already displayed and stays quiet.
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const fetchKey =
    userId && workspaceId && enabled ? `${userId}|${workspaceId}` : null
  const { ready, succeeded, failed } = useFetchStatus(snapshot, fetchKey, {
    load: '',
    refresh: '',
  })

  useEffect(() => {
    if (!userId || !workspaceId || !enabled || !fetchKey) return
    let cancelled = false
    const supabase = createClient()

    supabase
      .from('workspace_daily_summaries')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('report_end', { ascending: false })
      .limit(HISTORY_LIMIT)
      .then(({ data, error: fetchError }) => {
        if (cancelled) return
        // A failed read is not "no reports": keep what is shown.
        if (fetchError) {
          failed()
          return
        }
        confirm(((data ?? []) as SummaryRow[]).map(rowToSummary))
        succeeded()
      })

    const channel = supabase
      .channel(`workspace-summaries-${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workspace_daily_summaries',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        payload => {
          if (cancelled || payload.eventType === 'DELETE') return
          const incoming = rowToSummary(payload.new as SummaryRow)
          setHistory(current => {
            const next = [
              incoming,
              ...current.filter(s => s.id !== incoming.id),
            ]
            next.sort((a, b) => (a.reportEnd < b.reportEnd ? 1 : -1))
            return next.slice(0, HISTORY_LIMIT)
          })
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [
    userId,
    workspaceId,
    enabled,
    fetchKey,
    confirm,
    setHistory,
    succeeded,
    failed,
  ])

  // The most recently due/created report -- automatic generation always
  // produces (at most) one row per rolling window, ordered newest-first.
  const summary = history[0] ?? null

  const regenerate = useCallback(async () => {
    if (!workspaceId || !summary) {
      return { success: false as const, error: 'No report to regenerate yet.' }
    }
    setGenerating(true)
    setError(null)
    try {
      const response = await fetch('/api/workspace-summaries/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, reportEnd: summary.reportEnd }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        const message = data?.error || 'Failed to regenerate the report.'
        setError(message)
        return { success: false as const, error: message }
      }
      const updated = rowToSummary(data.summary as SummaryRow)
      setHistory(current => [
        updated,
        ...current.filter(s => s.id !== updated.id),
      ])
      return { success: true as const }
    } catch {
      const message = 'Could not reach the AI summary service.'
      setError(message)
      return { success: false as const, error: message }
    } finally {
      setGenerating(false)
    }
  }, [workspaceId, summary, setHistory])

  // Purely a display aid ("Next report: Today/Tomorrow at 12:00 PM") -- the
  // actual window is always computed server-side by the scheduler, never
  // here. Uses the workspace's own configured report_time, not a hardcoded
  // noon.
  const nextReportLabel = timezone
    ? (() => {
        const target = parseTimeOfDay(reportTime)
        const next = nextReportTime(timezone, target)
        const day = isLocalToday(next, timezone) ? 'Today' : 'Tomorrow'
        return `${day} at ${formatTimeOfDay(reportTime)}`
      })()
    : null

  return {
    summary,
    history,
    ready,
    error,
    generating,
    regenerate,
    nextReportLabel,
  }
}
