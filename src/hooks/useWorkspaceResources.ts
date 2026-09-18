import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AuthUser } from '@/hooks/useAuth'
import { WorkspaceResource } from '@/types/workspace'

type WorkspaceResourceRow = {
  id: string
  workspace_id: string
  goal_id: string | null
  uploaded_by: string
  file_name: string
  file_type: string
  file_size: number
  storage_path: string
  description: string | null
  created_at: string
  updated_at: string
}

function rowToResource(row: WorkspaceResourceRow): WorkspaceResource {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    goalId: row.goal_id,
    uploadedBy: row.uploaded_by,
    fileName: row.file_name,
    fileType: row.file_type,
    fileSize: row.file_size,
    storagePath: row.storage_path,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const BUCKET = 'workspace-resources'

// Files belong to the workspace (Supabase Storage holds the bytes, this
// table holds metadata) -- same postgres_changes realtime pattern as
// everything else. Upload is a two-step client flow (storage object, then
// metadata row) mirroring how a couple of other event types in this app are
// already client-logged rather than RPC-atomic; a failed second step is
// cleaned up best-effort rather than left to leak indefinitely.
export function useWorkspaceResources(
  workspaceId: string,
  user: AuthUser | null,
) {
  const userId = user?.id
  const [resources, setResources] = useState<WorkspaceResource[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (!userId || !workspaceId) {
      setResources([])
      setReady(true)
      return
    }
    let cancelled = false
    const supabase = createClient()

    const fetchResources = (showLoading: boolean) => {
      if (showLoading) setReady(false)
      supabase
        .from('workspace_resources')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .then(({ data, error: fetchError }) => {
          if (cancelled) return
          if (fetchError) {
            setError("Couldn't load resources.")
            setReady(true)
            return
          }
          setResources(
            ((data ?? []) as WorkspaceResourceRow[]).map(rowToResource),
          )
          setReady(true)
        })
    }

    fetchResources(true)

    const handleReconnect = () => fetchResources(false)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') handleReconnect()
    }
    window.addEventListener('online', handleReconnect)
    document.addEventListener('visibilitychange', handleVisibility)

    const channel = supabase
      .channel(`workspace-resources-${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workspace_resources',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        payload => {
          if (cancelled) return
          if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id?: string }).id
            if (deletedId)
              setResources(current => current.filter(r => r.id !== deletedId))
            return
          }
          const incoming = rowToResource(payload.new as WorkspaceResourceRow)
          setResources(current => {
            const exists = current.some(r => r.id === incoming.id)
            return exists
              ? current.map(r => (r.id === incoming.id ? incoming : r))
              : [incoming, ...current]
          })
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      window.removeEventListener('online', handleReconnect)
      document.removeEventListener('visibilitychange', handleVisibility)
      supabase.removeChannel(channel)
    }
  }, [userId, workspaceId])

  const upload = async (file: File, goalId: string | null = null) => {
    if (!userId) return false
    setUploading(true)
    const storagePath = `${workspaceId}/${crypto.randomUUID()}-${file.name}`
    const supabase = createClient()

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, file)
    if (uploadError) {
      setError("Couldn't upload the file.")
      setUploading(false)
      return false
    }

    const { error: insertError } = await supabase
      .from('workspace_resources')
      .insert({
        workspace_id: workspaceId,
        goal_id: goalId,
        uploaded_by: userId,
        file_name: file.name,
        file_type: file.type || 'application/octet-stream',
        file_size: file.size,
        storage_path: storagePath,
      })
    setUploading(false)
    if (insertError) {
      setError("Couldn't save the resource.")
      void supabase.storage.from(BUCKET).remove([storagePath])
      return false
    }
    return true
  }

  const remove = (id: string) => {
    const removed = resources.find(r => r.id === id)
    setResources(current => current.filter(r => r.id !== id))
    const supabase = createClient()
    void supabase
      .rpc('delete_workspace_resource', { p_resource_id: id })
      .then(({ error: rpcError }) => {
        if (rpcError) {
          setError("Couldn't delete the resource.")
          if (removed) setResources(current => [...current, removed])
        }
      })
  }

  const getSignedUrl = async (storagePath: string) => {
    const supabase = createClient()
    const { data, error: signError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, 60 * 5)
    if (signError || !data) return null
    return data.signedUrl
  }

  return { resources, ready, error, uploading, upload, remove, getSignedUrl }
}
