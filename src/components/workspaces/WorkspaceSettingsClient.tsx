'use client'

import { useState } from 'react'
import { WorkspaceSettingsSection } from '@/components/workspaces/WorkspaceSettingsSection'
import { EditWorkspaceModal } from '@/components/workspaces/EditWorkspaceModal'
import { useWorkspaceDetail } from '@/components/workspaces/WorkspaceDetailContext'
import { useSettings } from '@/hooks/useSettings'

export function WorkspaceSettingsClient() {
  const { workspace, ready, isOwner, isPersonal, updateWorkspace } =
    useWorkspaceDetail()
  const { settings, ready: settingsReady, updateSettings } = useSettings()
  const [editing, setEditing] = useState(false)
  const [settingsError, setSettingsError] = useState<string | null>(null)

  const handleUpdateWorkspace: typeof updateWorkspace = async patch => {
    const result = await updateWorkspace(patch)
    if (result.success) {
      setSettingsError(null)
    } else {
      setSettingsError(result.error || 'Failed to save changes.')
    }
    return result
  }

  return (
    <>
      <WorkspaceSettingsSection
        ready={ready}
        error={settingsError}
        workspace={workspace}
        isPersonal={isPersonal}
        canManage={isOwner}
        preferences={{
          ready: settingsReady,
          soundEnabled: settings.soundEnabled,
          onSoundEnabledChange: soundEnabled =>
            updateSettings({ soundEnabled }),
        }}
        onEdit={() => {
          setSettingsError(null)
          setEditing(true)
        }}
      />

      {editing && isOwner && workspace && (
        <EditWorkspaceModal
          workspace={workspace}
          isPersonal={isPersonal}
          onSave={handleUpdateWorkspace}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  )
}
