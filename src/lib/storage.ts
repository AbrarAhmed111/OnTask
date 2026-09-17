import { Settings, Task } from '@/types'

const TASKS_KEY = 'ontask-tasks-v2'
const SETTINGS_KEY = 'ontask-settings-v1'
const MIGRATION_KEY = 'ontask-migration-status-v1'
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
  }
}

// Tracks whether the guest→account migration prompt has already been
// answered on this device, so it doesn't reappear on every page load once
// the user has made a choice (moved their tasks, or chosen to keep them
// local). Dismissing/cancelling the prompt does NOT call this — only an
// explicit "keep local" or a successful migration does — so an undecided
// user keeps seeing it until they actually choose.
export function isMigrationResolved(): boolean {
  if (typeof window === 'undefined') return true
  return window.localStorage.getItem(MIGRATION_KEY) === 'resolved'
}

export function markMigrationResolved() {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(MIGRATION_KEY, 'resolved')
  }
}
