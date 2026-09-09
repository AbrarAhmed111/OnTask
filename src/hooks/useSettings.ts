import { useEffect, useState } from 'react'
import { loadSettings, saveSettings } from '@/lib/storage'
import { Settings } from '@/types'

export const defaultSettings: Settings = {
  dailyTargetMinutes: 480,
  soundEnabled: true,
  autoStartNextTask: false,
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setSettings(loadSettings())
    setReady(true)
  }, [])

  useEffect(() => {
    if (ready) saveSettings(settings)
  }, [ready, settings])

  const updateSettings = (update: Partial<Settings>) =>
    setSettings(current => ({ ...current, ...update }))
  const resetSettings = () => setSettings(defaultSettings)

  return { settings, ready, updateSettings, resetSettings }
}
