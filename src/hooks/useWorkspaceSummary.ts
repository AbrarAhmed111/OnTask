'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AuthUser } from '@/hooks/useAuth'
import { WorkspaceDailySummary } from '@/types/workspace'

type SummaryRow = {
  id: string
  workspace_id: string
  summary_date: string
  version: number
  structured_snapshot: WorkspaceDailySummary['structuredSnapshot']
  narrative: WorkspaceDailySummary['narrative']
  meta: WorkspaceDailySummary['meta']
  generated_by: string
  generated_at: string
  created_at: string
}

function rowToSummary(row: SummaryRow): WorkspaceDailySummary {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    summaryDate: row.summary_date,
    version: row.version,
    structuredSnapshot: row.structured_snapshot,
    narrative: row.narrative,
    meta: row.meta,
    generatedBy: row.generated_by,
    generatedAt: row.generated_at,
    createdAt: row.created_at,
  }
}

const HISTORY_LIMIT = 14

// "Yesterday" computed in the WORKSPACE's timezone, not the browser's — two
// members in different timezones must generate/see the same summary_date.
function yesterdayInTimezone(timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const year = Number(parts.find(p => p.type === 'year')?.value)
  const month = Number(parts.find(p => p.type === 'month')?.value)
  const day = Number(parts.find(p => p.type === 'day')?.value)
  const todayUtc = new Date(Date.UTC(year, month - 1, day))
  todayUtc.setUTCDate(todayUtc.getUTCDate() - 1)
  return todayUtc.toISOString().slice(0, 10)
}

// Fetches the workspace's daily AI summaries (most recent first), live-synced
// via postgres_changes, and exposes generate/regenerate which POST to the API
// route that talks to the ontask-llm service — a direct Supabase call can't
// reach that external service, so this is the one mutation here that isn't a
// plain `.from(...).insert/update` like the rest of this app's hooks.
export function useWorkspaceSummary(
  workspaceId: string,
  user: AuthUser | null,
  timezone: string,
) {
  const userId = user?.id
  const [history, setHistory] = useState<WorkspaceDailySummary[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  const summaryDate = timezone ? yesterdayInTimezone(timezone) : null

  useEffect(() => {
    if (!userId || !workspaceId) {
      setHistory([])
      setReady(true)
      return
    }
    let cancelled = false
    const supabase = createClient()

    supabase
      .from('workspace_daily_summaries')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('summary_date', { ascending: false })
      .limit(HISTORY_LIMIT)
      .then(({ data }) => {
        if (cancelled) return
        setHistory(((data ?? []) as SummaryRow[]).map(rowToSummary))
        setReady(true)
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
            next.sort((a, b) => (a.summaryDate < b.summaryDate ? 1 : -1))
            return next.slice(0, HISTORY_LIMIT)
          })
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [userId, workspaceId])

  const generate = useCallback(
    async (mode: 'generate' | 'regenerate' = 'generate') => {
      if (!workspaceId || !summaryDate) {
        return { success: false as const, error: 'Workspace not ready yet.' }
      }
      setGenerating(true)
      setError(null)
      try {
        const response = await fetch('/api/workspace-summaries/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspaceId, summaryDate, mode }),
        })
        const data = await response.json().catch(() => null)
        if (!response.ok) {
          const message = data?.error || 'Failed to generate the summary.'
          setError(message)
          return { success: false as const, error: message }
        }
        const summary = rowToSummary(data.summary as SummaryRow)
        setHistory(current => [
          summary,
          ...current.filter(s => s.id !== summary.id),
        ])
        return { success: true as const }
      } catch {
        const message = 'Could not reach the AI summary service.'
        setError(message)
        return { success: false as const, error: message }
      } finally {
        setGenerating(false)
      }
    },
    [workspaceId, summaryDate],
  )

  const summary = summaryDate
    ? (history.find(s => s.summaryDate === summaryDate) ?? null)
    : null

  return { summary, history, ready, error, generating, generate, summaryDate }
}
