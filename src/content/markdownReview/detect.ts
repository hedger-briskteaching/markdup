const PR_FILES_PATH =
  /^\/[^/]+\/[^/]+\/pull\/\d+\/(?:files|changes)(?:\/.*)?$/

/** Bidirectional marks GitHub wraps around file paths in the header. */
const BIDI_MARKS = /[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g

/** Strip bidi marks / whitespace GitHub embeds in header path text. */
export function cleanFilePath(raw: string): string {
  return raw.replace(BIDI_MARKS, '').trim()
}

/** True on GitHub PR "Files changed" pages (classic /files or new /changes). */
export function isPrFilesPage(pathname = location.pathname): boolean {
  return PR_FILES_PATH.test(pathname)
}

export function isMarkdownPath(path: string): boolean {
  const lower = cleanFilePath(path).toLowerCase()
  return lower.endsWith('.md') || lower.endsWith('.markdown')
}

/** Prefer data-file-path; fall back to header link text. */
export function getFilePath(region: Element): string | null {
  const pathButton = region.querySelector<HTMLElement>('button[data-file-path]')
  const fromAttr = pathButton?.getAttribute('data-file-path')
  if (fromAttr) {
    const cleaned = cleanFilePath(fromAttr)
    if (cleaned) {
      return cleaned
    }
  }

  const link = region.querySelector<HTMLAnchorElement>(
    '[data-diff-header-wrapper] h3 a',
  )
  const fromLink = link?.textContent
  if (fromLink) {
    const cleaned = cleanFilePath(fromLink)
    if (cleaned) {
      return cleaned
    }
  }

  return null
}
