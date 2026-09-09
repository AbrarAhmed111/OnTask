import { useEffect, useState } from 'react'
import { Task } from '@/types'

export function useTimer() {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  return now
}

export function getLiveSeconds(task: Task, now: number) {
  return (
    task.workedSeconds +
    (task.status === 'active' && task.startedAt
      ? Math.max(0, now - task.startedAt) / 1000
      : 0)
  )
}
