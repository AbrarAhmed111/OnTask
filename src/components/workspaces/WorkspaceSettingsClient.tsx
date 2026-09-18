'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { WorkspaceSettingsSection } from '@/components/workspaces/WorkspaceSettingsSection'
import { EditWorkspaceModal } from '@/components/workspaces/EditWorkspaceModal'
import { useWorkspaceDetail } from '@/components/workspaces/WorkspaceDetailContext'

export function WorkspaceSettingsClient() {
  const router = useRouter()
  const { workspaceId, workspace, ready, isOwner, updateWorkspace } =
    useWorkspaceDetail()
  const [editing, setEditing] = useState(false)
  const [settingsError, setSettingsError] = useState<string | null>(null)

  useEffect(() => {
    if (ready && !isOwner) router.replace(`/workspaces/${workspaceId}`)
  }, [ready, isOwner, router, workspaceId])

  if (!isOwner) return null

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
        onEdit={() => {
          setSettingsError(null)
          setEditing(true)
        }}
      />

      {editing && workspace && (
        <EditWorkspaceModal
          workspace={workspace}
          onSave={handleUpdateWorkspace}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  )
}
