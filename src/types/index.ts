export type TaskStatus =
  'pending' | 'active' | 'paused' | 'completed' | 'skipped'

export type Task = {
  id: string
  name: string
  plannedMinutes: number
  workedSeconds: number
  status: TaskStatus
  goalName?: string
  goalProgress?: number
  startedAt: number | null
}

export type TaskFormValues = {
  name: string
  hours: string
  minutes: string
  goal: string
  progress: string
  trackGoal: boolean
}

export type Settings = {
  dailyTargetMinutes: number
  soundEnabled: boolean
  autoStartNextTask: boolean
}
