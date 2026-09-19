/**
 * Centralized URL & deep-link utility for OnTask.
 * Generates absolute deep links for Slack notifications and external surfaces.
 */

export function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/+$/, '')
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  return 'http://localhost:3000'
}

export function getWorkspaceUrl(workspaceSlug: string): string {
  return `${getBaseUrl()}/workspaces/${encodeURIComponent(workspaceSlug)}`
}

export function getTaskUrl(workspaceSlug: string, taskId: string): string {
  return `${getWorkspaceUrl(workspaceSlug)}?task=${encodeURIComponent(taskId)}`
}

export function getReportUrl(workspaceSlug: string, reportId?: string): string {
  if (reportId) {
    return `${getWorkspaceUrl(workspaceSlug)}?report=${encodeURIComponent(reportId)}`
  }
  return getWorkspaceUrl(workspaceSlug)
}
