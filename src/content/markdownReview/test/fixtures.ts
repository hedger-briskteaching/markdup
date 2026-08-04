/** Minimal GitHub PR Files changed file-region fixture for unit tests. */

export type FileRegionOptions = {
  path: string
  id?: string
  includeKebab?: boolean
  includeDiffBody?: boolean
  includeFileViewToggle?: boolean
  pathViaLinkOnly?: boolean
  /**
   * When set, adds GitHub-style file expand/collapse chevron.
   * Matches the new Files UI: octicon + Primer tooltip (no aria-expanded),
   * plus DiffFileHeader-module__collapsed when folded.
   */
  fileExpanded?: boolean
  /** Include the "Expand all lines" header control. */
  includeExpandAllLines?: boolean
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
    includeExpandAllLines = false,
  } = options

  const region = document.createElement('div')
  region.setAttribute('role', 'region')
  region.id = id

  const header = document.createElement('div')
  header.setAttribute('data-diff-header-wrapper', '')

  const fileHeader = document.createElement('div')
  fileHeader.className = 'DiffFileHeader-module__diff-file-header__UuNN4'
  if (fileExpanded === false) {
    fileHeader.classList.add('DiffFileHeader-module__collapsed__ZY5uc')
  }

  if (fileExpanded !== undefined) {
    const collapseBtn = document.createElement('button')
    collapseBtn.type = 'button'
    collapseBtn.setAttribute('data-component', 'IconButton')
    const tipId = `tip-collapse-${id}`
    collapseBtn.setAttribute('aria-labelledby', tipId)
    const icon = document.createElement('svg')
    icon.classList.add(
      'octicon',
      fileExpanded ? 'octicon-chevron-down' : 'octicon-chevron-right',
    )
    collapseBtn.appendChild(icon)
    const tip = document.createElement('span')
    tip.id = tipId
    tip.setAttribute('data-component', 'Tooltip')
    tip.textContent = fileExpanded ? 'Collapse file' : 'Expand file'
    fileHeader.appendChild(collapseBtn)
    fileHeader.appendChild(tip)
  }

  const title = document.createElement('h3')
  const link = document.createElement('a')
  link.href = '#'
  link.textContent = path
  title.appendChild(link)
  fileHeader.appendChild(title)

  if (!pathViaLinkOnly) {
    const pathButton = document.createElement('button')
    pathButton.type = 'button'
    pathButton.setAttribute('data-file-path', path)
    pathButton.textContent = path
    fileHeader.appendChild(pathButton)
  }

  if (includeExpandAllLines) {
    const expandAll = document.createElement('button')
    expandAll.type = 'button'
    expandAll.setAttribute('aria-label', `Expand all lines: ${path}`)
    expandAll.setAttribute('data-file-path', path)
    const unfold = document.createElement('svg')
    unfold.classList.add('octicon', 'octicon-unfold')
    expandAll.appendChild(unfold)
    fileHeader.appendChild(expandAll)
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

  fileHeader.appendChild(actions)
  header.appendChild(fileHeader)
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

/** Flip a fixture between expanded and collapsed GitHub header states. */
export function setFileCollapsed(region: Element, collapsed: boolean): void {
  const fileHeader = region.querySelector(
    '[class*="DiffFileHeader-module__diff-file-header"]',
  )
  if (fileHeader) {
    fileHeader.classList.toggle(
      'DiffFileHeader-module__collapsed__ZY5uc',
      collapsed,
    )
  }

  const icon = region.querySelector(
    'svg.octicon-chevron-down, svg.octicon-chevron-right',
  )
  if (icon) {
    icon.classList.toggle('octicon-chevron-down', !collapsed)
    icon.classList.toggle('octicon-chevron-right', collapsed)
  }

  const tip = region.querySelector('[data-component="Tooltip"]')
  if (
    tip &&
    (tip.textContent === 'Collapse file' || tip.textContent === 'Expand file')
  ) {
    tip.textContent = collapsed ? 'Expand file' : 'Collapse file'
  }

  if (collapsed) {
    region
      .querySelector('div.border.position-relative.rounded-bottom-2')
      ?.remove()
  }
}

export function setPathname(pathname: string): void {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { pathname },
  })
}
