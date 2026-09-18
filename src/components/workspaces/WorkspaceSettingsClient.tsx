'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { WorkspaceSettingsSection } from '@/components/workspaces/WorkspaceSettingsSection'
import { EditWorkspaceModal } from '@/components/workspaces/EditWorkspaceModal'
import { useWorkspaceDetail } from '@/components/workspaces/WorkspaceDetailContext'

export function WorkspaceSettingsClient() {
  const router = useRouter()
  const { workspace, ready, isOwner, isPersonal, updateWorkspace } =
    useWorkspaceDetail()
  const [editing, setEditing] = useState(false)
  const [settingsError, setSettingsError] = useState<string | null>(null)

  useEffect(() => {
    if (ready && !isOwner && workspace)
      router.replace(`/workspaces/${workspace.slug}`)
  }, [ready, isOwner, router, workspace])

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
        isPersonal={isPersonal}
        onEdit={() => {
          setSettingsError(null)
          setEditing(true)
        }}
      />

      {editing && workspace && (
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
