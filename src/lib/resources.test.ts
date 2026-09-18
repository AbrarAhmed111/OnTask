import { describe, expect, it } from 'vitest'
import { categorize, formatFileSize } from './resources'

describe('categorize', () => {
  it('recognizes PDFs', () => {
    expect(categorize('application/pdf')).toBe('pdfs')
  })
  it('recognizes images', () => {
    expect(categorize('image/png')).toBe('images')
    expect(categorize('image/jpeg')).toBe('images')
  })
  it('recognizes common document types', () => {
    expect(categorize('application/msword')).toBe('documents')
    expect(
      categorize(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ),
    ).toBe('documents')
    expect(categorize('application/vnd.ms-excel')).toBe('documents')
    expect(categorize('text/csv')).toBe('documents')
  })
  it('falls back to other for anything unrecognized', () => {
    expect(categorize('application/zip')).toBe('other')
  })
})

describe('formatFileSize', () => {
  it('formats bytes', () => {
    expect(formatFileSize(500)).toBe('500 B')
  })
  it('formats kilobytes', () => {
    expect(formatFileSize(2048)).toBe('2.0 KB')
  })
  it('formats megabytes', () => {
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB')
  })
})
