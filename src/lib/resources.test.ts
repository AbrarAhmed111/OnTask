import { describe, expect, it } from 'vitest'
import {
  buildStoragePath,
  canPreviewContent,
  categorize,
  classifyDeleteError,
  fileExtension,
  formatFileSize,
  getPreviewKind,
  IMAGE_PREVIEW_MAX_BYTES,
  parseCsvSample,
  readTextSample,
  resourceTypeLabel,
  sampleTextLines,
  storageFileName,
  TEXT_PREVIEW_MAX_BYTES,
} from './resources'

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

describe('fileExtension', () => {
  it('lower-cases the last extension', () => {
    expect(fileExtension('Report.FINAL.PDF')).toBe('pdf')
    expect(fileExtension('archive.tar.gz')).toBe('gz')
  })
  it('is empty when there is no real extension', () => {
    expect(fileExtension('README')).toBe('')
    expect(fileExtension('.env')).toBe('')
    expect(fileExtension('trailing.')).toBe('')
  })
})

describe('getPreviewKind', () => {
  const docx =
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  const xlsx =
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  const pptx =
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'

  it('classifies each supported type by extension', () => {
    expect(getPreviewKind('a.png', 'image/png')).toBe('image')
    expect(getPreviewKind('a.JPG', 'image/jpeg')).toBe('image')
    expect(getPreviewKind('a.pdf', 'application/pdf')).toBe('pdf')
    expect(getPreviewKind('a.doc', 'application/msword')).toBe('word')
    expect(getPreviewKind('a.docx', docx)).toBe('word')
    expect(getPreviewKind('a.xls', 'application/vnd.ms-excel')).toBe('excel')
    expect(getPreviewKind('a.xlsx', xlsx)).toBe('excel')
    expect(getPreviewKind('a.csv', 'text/csv')).toBe('csv')
    expect(getPreviewKind('a.ppt', 'application/vnd.ms-powerpoint')).toBe(
      'powerpoint',
    )
    expect(getPreviewKind('a.pptx', pptx)).toBe('powerpoint')
    expect(getPreviewKind('a.txt', 'text/plain')).toBe('text')
    expect(getPreviewKind('a.md', '')).toBe('text')
  })

  it('trusts the extension over an unreliable MIME type', () => {
    // Windows reports a .csv as an Excel type when Excel is installed.
    expect(getPreviewKind('students.csv', 'application/vnd.ms-excel')).toBe(
      'csv',
    )
    expect(getPreviewKind('notes.md', 'application/octet-stream')).toBe('text')
  })

  it('falls back to the MIME type when the extension is unknown', () => {
    expect(getPreviewKind('scan', 'image/heic')).toBe('image')
    expect(getPreviewKind('report', 'application/pdf')).toBe('pdf')
    expect(getPreviewKind('sheet', xlsx)).toBe('excel')
    expect(getPreviewKind('slides', pptx)).toBe('powerpoint')
    expect(getPreviewKind('readme', 'text/x-markdown')).toBe('text')
  })

  it('uses the generic kind for anything else', () => {
    expect(getPreviewKind('bundle.zip', 'application/zip')).toBe('other')
    expect(getPreviewKind('mystery', 'application/octet-stream')).toBe('other')
  })
})

describe('resourceTypeLabel', () => {
  it('shows the upper-cased extension', () => {
    expect(resourceTypeLabel('photo.jpg')).toBe('JPG')
    expect(resourceTypeLabel('deck.pptx')).toBe('PPTX')
  })
  it('falls back to FILE for no extension or an unreasonably long one', () => {
    expect(resourceTypeLabel('README')).toBe('FILE')
    expect(resourceTypeLabel('weird.extensionname')).toBe('FILE')
  })
})

describe('canPreviewContent', () => {
  it('loads image bytes only up to the image budget', () => {
    expect(canPreviewContent('image', 1024)).toBe('image')
    expect(canPreviewContent('image', IMAGE_PREVIEW_MAX_BYTES)).toBe('image')
    expect(canPreviewContent('image', IMAGE_PREVIEW_MAX_BYTES + 1)).toBeNull()
  })
  it('samples text and CSV only up to the text budget', () => {
    expect(canPreviewContent('text', 10)).toBe('text')
    expect(canPreviewContent('csv', TEXT_PREVIEW_MAX_BYTES)).toBe('text')
    expect(canPreviewContent('csv', TEXT_PREVIEW_MAX_BYTES + 1)).toBeNull()
  })
  it('never fetches content for kinds drawn as a static visual', () => {
    for (const kind of ['pdf', 'word', 'excel', 'powerpoint', 'other'] as const)
      expect(canPreviewContent(kind, 1)).toBeNull()
  })
})

describe('storageFileName / buildStoragePath', () => {
  it('leaves an already-safe name alone', () => {
    expect(storageFileName('requirements.docx')).toBe('requirements.docx')
    expect(storageFileName('my-file_v2.PDF')).toBe('my-file_v2.pdf')
  })
  it('replaces characters storage keys reject', () => {
    expect(storageFileName('résumé final #2?.pdf')).toBe('resume_final_2.pdf')
    expect(storageFileName('a b/c\\d.png')).toBe('a_b_c_d.png')
  })
  it('never yields an empty stem', () => {
    expect(storageFileName('###.pdf')).toBe('file.pdf')
    expect(storageFileName('日本語')).toBe('file')
  })
  it('caps very long names but keeps the extension', () => {
    const name = `${'x'.repeat(300)}.docx`
    const safe = storageFileName(name)
    expect(safe.endsWith('.docx')).toBe(true)
    expect(safe.length).toBeLessThanOrEqual(90)
  })
  it('keeps the {workspace}/{uuid}-{name} convention storage RLS relies on', () => {
    expect(buildStoragePath('ws-1', 'abc', 'notes.txt')).toBe(
      'ws-1/abc-notes.txt',
    )
    // A slash in the original name must not add a path segment.
    expect(buildStoragePath('ws-1', 'abc', 'a/b.txt').split('/')).toHaveLength(
      2,
    )
  })
})

describe('sampleTextLines', () => {
  it('returns the first few non-empty lines, right-trimmed', () => {
    expect(sampleTextLines('one  \n\n two\r\nthree\n', 2)).toEqual([
      'one',
      ' two',
    ])
  })
  it('clips long lines', () => {
    expect(sampleTextLines('x'.repeat(200), 7, 10)).toEqual(['xxxxxxxxxx'])
  })
  it('drops a leading BOM', () => {
    expect(sampleTextLines('\ufeffhello')).toEqual(['hello'])
  })
  it('is empty for an empty file', () => {
    expect(sampleTextLines('')).toEqual([])
  })
  it('rejects binary content', () => {
    expect(sampleTextLines('PK\u0003\u0004\u0000\u0000data')).toBeNull()
    expect(sampleTextLines('\ufffd'.repeat(50) + 'text')).toBeNull()
  })
  it('tolerates one cut multi-byte character at the end of a sample', () => {
    expect(sampleTextLines('hello wor\ufffd')).toEqual(['hello wor\ufffd'])
  })
})

describe('parseCsvSample', () => {
  it('parses the leading rows and columns', () => {
    expect(
      parseCsvSample('Name,Status,Score\nAda,Active,10\nGrace,Away,8\n'),
    ).toEqual([
      ['Name', 'Status', 'Score'],
      ['Ada', 'Active', '10'],
      ['Grace', 'Away', '8'],
    ])
  })
  it('limits rows and columns', () => {
    const csv = 'a,b,c,d,e,f\n1,2,3,4,5,6\n7,8,9,10,11,12\n'
    expect(parseCsvSample(csv, 2, 3)).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ])
  })
  it('handles quoted cells containing delimiters, quotes and newlines', () => {
    expect(
      parseCsvSample('name,note\n"Doe, Jo","said ""hi""\nthere"\n'),
    ).toEqual([
      ['name', 'note'],
      ['Doe, Jo', 'said "hi"\nthere'],
    ])
  })
  it('detects semicolon and tab delimiters', () => {
    expect(parseCsvSample('a;b\n1;2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
    expect(parseCsvSample('a\tb\n1\t2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })
  it('keeps a row cut off mid-way by the byte limit', () => {
    expect(parseCsvSample('a,b\n1,2\n3,')).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', ''],
    ])
  })
  it('pads short rows so the grid stays rectangular', () => {
    expect(parseCsvSample('a,b,c\n1\n')).toEqual([
      ['a', 'b', 'c'],
      ['1', '', ''],
    ])
  })
  it('skips blank lines, and is empty for an empty file', () => {
    expect(parseCsvSample('a,b\n\n\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
    expect(parseCsvSample('')).toEqual([])
  })
  it('rejects binary content', () => {
    expect(parseCsvSample('PK\u0003\u0004\u0000')).toBeNull()
  })
})

describe('readTextSample', () => {
  it('decodes a small body in full', async () => {
    expect(await readTextSample(new Response('a,b\n1,2'))).toBe('a,b\n1,2')
  })
  it('stops at the byte budget instead of reading the whole body', async () => {
    let pulled = 0
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled++
        controller.enqueue(new TextEncoder().encode('x'.repeat(1000)))
        if (pulled >= 1000) controller.close()
      },
    })
    const text = await readTextSample(new Response(body), 2500)
    expect(text).toBe('x'.repeat(2500))
    // A handful of chunks (plus the stream's own read-ahead), never all 1000.
    expect(pulled).toBeLessThan(10)
  })
  it('returns null for an error response', async () => {
    expect(
      await readTextSample(new Response('nope', { status: 403 })),
    ).toBeNull()
  })
})

describe('classifyDeleteError', () => {
  it('treats an already-deleted resource as done, not as a failure to undo', () => {
    expect(classifyDeleteError({ message: 'resource not found' })).toEqual({
      alreadyGone: true,
      message: 'That resource was already deleted.',
    })
  })
  it('explains a permission failure', () => {
    const result = classifyDeleteError({ message: 'not authorized' })
    expect(result.alreadyGone).toBe(false)
    expect(result.message).toMatch(/uploader or the workspace owner/)
  })
  it('does not mistake "not authenticated" for a permission failure', () => {
    expect(classifyDeleteError({ message: 'not authenticated' }).message).toBe(
      "Couldn't delete the resource.",
    )
  })
  it('uses a generic message for anything else, including a non-error', () => {
    const storage = {
      message: 'Direct deletion from storage tables is not allowed.',
    }
    expect(classifyDeleteError(storage)).toEqual({
      alreadyGone: false,
      message: "Couldn't delete the resource.",
    })
    expect(classifyDeleteError(null).message).toBe(
      "Couldn't delete the resource.",
    )
  })
})
