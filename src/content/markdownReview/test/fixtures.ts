/** Minimal GitHub PR Files changed file-region fixture for unit tests. */

export type FileRegionOptions = {
  path: string
  id?: string
  includeKebab?: boolean
  includeDiffBody?: boolean
  includeFileViewToggle?: boolean
  pathViaLinkOnly?: boolean
  /** When set, adds GitHub-style file expand/collapse chevron with aria-expanded. */
  fileExpanded?: boolean
}

export function createFileRegion(options: FileRegionOptions): HTMLElement {
  const {
    path,
    id = `diff-${path.replace(/[^\w.-]+/g, '-')}`,
    includeKebab = true,
    includeDiffBody = true,
    includeFileViewToggle = true,
    pathViaLinkOnly = false,
    fileExpanded,
  } = options

  const region = document.createElement('div')
  region.setAttribute('role', 'region')
  region.id = id

  const header = document.createElement('div')
  header.setAttribute('data-diff-header-wrapper', '')

  if (fileExpanded !== undefined) {
    const collapseBtn = document.createElement('button')
    collapseBtn.type = 'button'
    collapseBtn.setAttribute('aria-expanded', String(fileExpanded))
    collapseBtn.setAttribute(
      'aria-label',
      fileExpanded ? 'Collapse file' : 'Expand file',
    )
    collapseBtn.textContent = fileExpanded ? 'v' : '>'
    header.appendChild(collapseBtn)
  }

  const title = document.createElement('h3')
  const link = document.createElement('a')
  link.href = '#'
  link.textContent = path
  title.appendChild(link)
  header.appendChild(title)

  if (!pathViaLinkOnly) {
    const pathButton = document.createElement('button')
    pathButton.type = 'button'
    pathButton.setAttribute('data-file-path', path)
    pathButton.textContent = path
    header.appendChild(pathButton)
  }

  const actions = document.createElement('div')
  actions.className = 'd-flex flex-items-center gap-2'

  if (includeFileViewToggle) {
    const segmented = document.createElement('ul')
    segmented.setAttribute('aria-label', 'File view')
    segmented.setAttribute('data-component', 'SegmentedControl')
    segmented.setAttribute('data-size', 'small')

    const sourceItem = document.createElement('li')
    sourceItem.setAttribute('data-selected', 'true')
    const sourceBtn = document.createElement('button')
    sourceBtn.type = 'button'
    sourceBtn.setAttribute('aria-pressed', 'true')
    sourceBtn.setAttribute('aria-label', 'Display the source diff')
    sourceItem.appendChild(sourceBtn)
    segmented.appendChild(sourceItem)

    const richItem = document.createElement('li')
    const richBtn = document.createElement('button')
    richBtn.type = 'button'
    richBtn.setAttribute('aria-pressed', 'false')
    richBtn.setAttribute('aria-label', 'Display the rich diff')
    richItem.appendChild(richBtn)
    segmented.appendChild(richItem)

    actions.appendChild(segmented)
  }

  const viewed = document.createElement('button')
  viewed.type = 'button'
  viewed.setAttribute('aria-label', 'Not Viewed')
  viewed.textContent = 'Viewed'
  actions.appendChild(viewed)

  const comment = document.createElement('button')
  comment.type = 'button'
  comment.setAttribute('aria-label', 'Comment on this file')
  comment.textContent = 'Comment'
  actions.appendChild(comment)

  if (includeKebab) {
    const kebab = document.createElement('button')
    kebab.type = 'button'
    kebab.setAttribute('aria-label', 'More options')
    kebab.setAttribute('aria-haspopup', 'true')
    const icon = document.createElement('svg')
    icon.classList.add('octicon-kebab-horizontal')
    kebab.appendChild(icon)
    actions.appendChild(kebab)
  }

  header.appendChild(actions)
  region.appendChild(header)

  if (includeDiffBody) {
    const body = document.createElement('div')
    body.className = 'border position-relative rounded-bottom-2'
    const table = document.createElement('table')
    table.setAttribute('aria-label', `Diff for: ${path}`)
    body.appendChild(table)
    region.appendChild(body)
  }

  return region
}

export function setPathname(pathname: string): void {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { pathname },
  })
}
