import { Settings, Task } from '@/types'

// ── Where state lives in OnTask ─────────────────────────────────────────────
// Persistence follows what the state belongs to, never which component
// happens to be mounted:
//
//  Guest tasks            -> localStorage (this file). Local-first: a guest
//                            never touches Supabase. When they sign in, the
//                            guest -> account prompt below offers to import
//                            them into their Personal Workspace.
//  Preferences            -> localStorage (this file: `Settings`, e.g. the
//                            completion sound). Per person and per device, so
//                            they apply the same to a guest, a personal
//                            workspace and every shared workspace — there is
//                            deliberately no per-workspace copy.
//  Workspace state        -> Supabase, for personal AND shared workspaces
//  (tasks, goals, notes,     alike: a signed-in user's Personal Workspace is
//  resources, name,          an ordinary `workspaces` row (type = 'personal'),
//  accent, timezone, ...)    so it is server-backed under RLS with realtime,
//                            not localStorage. The workspace accent is a
//                            property of the workspace (everyone in it sees
//                            the same one), not of the viewer.
//  Workspace identity     -> localStorage, as a paint-first *cache only*
//  (name/accent/timezone)    (lib/redux/persist.ts) so a refresh doesn't
//                            flash defaults. Supabase stays the source of
//                            truth and overwrites it on every load.
//
// The app has no light/dark mode; "theme" means the workspace accent.

const TASKS_KEY = 'ontask-tasks-v2'
const SETTINGS_KEY = 'ontask-settings-v1'
// Legacy (pre-Personal-Workspace) flag: a single "the guest -> account prompt
// was answered on this device" boolean. Superseded by RESOLVED_TASKS_KEY
// below; only read once, to honour an answer given before the upgrade.
const LEGACY_MIGRATION_KEY = 'ontask-migration-status-v1'
const RESOLVED_TASKS_KEY = 'ontask-guest-work-resolved-v2'
const DEFAULT_SETTINGS: Settings = {
  dailyTargetMinutes: 480,
  soundEnabled: true,
  autoStartNextTask: false,
}

export function loadTasks(): Task[] {
  if (typeof window === 'undefined') return []
  try {
    const value = window.localStorage.getItem(TASKS_KEY)
    return value ? (JSON.parse(value) as Task[]) : []
  } catch {
    return []
  }
}

export function saveTasks(tasks: Task[]) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(TASKS_KEY, JSON.stringify(tasks))
  }
}

export function loadSettings(): Settings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const value = window.localStorage.getItem(SETTINGS_KEY)
    return value
      ? { ...DEFAULT_SETTINGS, ...JSON.parse(value) }
      : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: Settings) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  }
}

export function clearStoredData() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(TASKS_KEY)
    window.localStorage.removeItem(SETTINGS_KEY)
    window.localStorage.removeItem(RESOLVED_TASKS_KEY)
  }
}

// ── guest work -> Personal Workspace prompt ────────────────────────────────
// When a guest signs in, the app offers to save their local tasks into their
// Personal Workspace. Which tasks have already been dealt with is tracked per
// TASK ID (not as one on/off flag), so choosing "Start Fresh" for today's
// tasks doesn't silence the prompt forever: tasks added later, as a guest,
// still get offered next time. Dismissing the prompt with its close button
// records nothing — an undecided user keeps seeing it.

export function filterUnresolvedTasks(
  tasks: Task[],
  resolvedIds: ReadonlySet<string>,
): Task[] {
  return tasks.filter(task => !resolvedIds.has(task.id))
}

function loadResolvedTaskIds(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const value = window.localStorage.getItem(RESOLVED_TASKS_KEY)
    const parsed = value ? (JSON.parse(value) as unknown) : []
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((id): id is string => typeof id === 'string')
        : [],
    )
  } catch {
    return new Set()
  }
}

// Marks these tasks as answered ("saved" or "start fresh") so the prompt
// doesn't offer them again.
export function markGuestTasksResolved(taskIds: string[]) {
  if (typeof window === 'undefined') return
  const resolved = loadResolvedTaskIds()
  taskIds.forEach(id => resolved.add(id))
  window.localStorage.setItem(RESOLVED_TASKS_KEY, JSON.stringify([...resolved]))
}

// The local tasks the guest -> Personal Workspace prompt should still offer.
export function loadUnresolvedGuestTasks(): Task[] {
  const tasks = loadTasks()
  if (tasks.length === 0 || typeof window === 'undefined') return []

  // An answer recorded under the old single-flag scheme covers whatever was
  // on this device at the time of the upgrade.
  if (
    window.localStorage.getItem(LEGACY_MIGRATION_KEY) === 'resolved' &&
    window.localStorage.getItem(RESOLVED_TASKS_KEY) === null
  ) {
    markGuestTasksResolved(tasks.map(task => task.id))
    return []
  }

  return filterUnresolvedTasks(tasks, loadResolvedTaskIds())
}
