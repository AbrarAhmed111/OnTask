export type ResourceCategory = 'documents' | 'images' | 'pdfs' | 'other'

export function categorize(fileType: string): ResourceCategory {
  if (fileType === 'application/pdf') return 'pdfs'
  if (fileType.startsWith('image/')) return 'images'
  if (
    fileType.includes('word') ||
    fileType.includes('document') ||
    fileType.includes('sheet') ||
    fileType.includes('excel') ||
    fileType.includes('presentation') ||
    fileType.includes('powerpoint') ||
    fileType === 'text/plain' ||
    fileType === 'text/csv'
  )
    return 'documents'
  return 'other'
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
