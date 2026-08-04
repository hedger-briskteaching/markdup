const PR_FILES_PATH =
  /^\/[^/]+\/[^/]+\/pull\/\d+\/(?:files|changes)(?:\/.*)?$/

/** True on GitHub PR "Files changed" pages (classic /files or new /changes). */
export function isPrFilesPage(pathname = location.pathname): boolean {
  return PR_FILES_PATH.test(pathname)
}

export function isMarkdownPath(path: string): boolean {
  const lower = path.toLowerCase()
  return lower.endsWith('.md') || lower.endsWith('.markdown')
}

/** Prefer data-file-path; fall back to header link text. */
export function getFilePath(region: Element): string | null {
  const pathButton = region.querySelector<HTMLElement>('button[data-file-path]')
  const fromAttr = pathButton?.getAttribute('data-file-path')?.trim()
  if (fromAttr) {
    return fromAttr
  }

  const link = region.querySelector<HTMLAnchorElement>(
    '[data-diff-header-wrapper] h3 a',
  )
  const fromLink = link?.textContent?.trim()
  return fromLink || null
}
