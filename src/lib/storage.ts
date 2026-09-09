import { Settings, Task } from '@/types'

const TASKS_KEY = 'ontask-tasks-v2'
const SETTINGS_KEY = 'ontask-settings-v1'
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
