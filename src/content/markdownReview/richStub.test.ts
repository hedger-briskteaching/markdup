import { beforeEach, describe, expect, it } from 'vitest'
import {
  hideRichView,
  isRichMode,
  renderRowsForTest,
  showRichView,
} from './richView'
import { setRichModeFromTexts } from './richStub'
import { createFileRegion } from './test/fixtures'
import { alignMarkdown } from '../../markdown/align'
import { clearSnapshotCache } from './snapshotCache'

describe('richView', () => {
  let region: HTMLElement

  beforeEach(() => {
    clearSnapshotCache()
    document.body.innerHTML = ''
    region = createFileRegion({ path: 'docs/PLAN.md' })
    document.body.appendChild(region)
  })

  it('hides the native diff and renders Before/After columns', () => {
    setRichModeFromTexts(
      region,
      '# Title\n\nOld text.\n',
      '# Title\n\nNew text here.\n',
    )

    const diffBody = region.querySelector(
      'div.border.position-relative.rounded-bottom-2',
    )
    expect(diffBody?.hasAttribute('data-rgm-diff-hidden')).toBe(true)

    const rich = region.querySelector('[data-rgm-rich]')
    expect(rich).not.toBeNull()
    expect(rich?.textContent).toContain('Before')
    expect(rich?.textContent).toContain('After')
    expect(rich?.textContent).not.toContain('coming soon')
    expect(rich?.textContent).toContain('New text here.')
    // Unchanged sections start collapsed behind a fold bar.
    expect(rich?.textContent).not.toContain('Title')
    const toggle = rich?.querySelector<HTMLButtonElement>(
      '[data-rgm-fold-toggle]',
    )
    expect(toggle).not.toBeNull()
    toggle?.click()
    expect(rich?.textContent).toContain('Title')
    expect(isRichMode(region)).toBe(true)
  })

  it('shows not present on the missing side for additions', () => {
    const rows = alignMarkdown('# Only\n', '# Only\n\n## Added\n')
    const host = renderRowsForTest(rows)
    expect(host.textContent).toContain('not present')
    expect(host.textContent).toContain('Added')
  })

  it('applies inline insert marks on the After side', () => {
    const rows = alignMarkdown('Hello world.\n', 'Hello brave world.\n')
    const host = renderRowsForTest(rows)
    const ins = host.querySelector('.rgm-rich-ins')
    expect(ins?.textContent).toContain('brave')
    expect(host.querySelector('.rgm-rich-cell-add')).not.toBeNull()
    expect(host.querySelector('.rgm-rich-cell-del')).not.toBeNull()
  })

  it('restores the native diff when rich view is hidden', () => {
    setRichModeFromTexts(region, 'A\n', 'B\n')
    hideRichView(region)
    region.removeAttribute('data-rgm-mode')

    const diffBody = region.querySelector(
      'div.border.position-relative.rounded-bottom-2',
    )
    expect(diffBody?.hasAttribute('data-rgm-diff-hidden')).toBe(false)
    expect(region.querySelector('[data-rgm-rich]')).toBeNull()
  })

  it('renders front matter as a labeled card', () => {
    const rows = alignMarkdown(
      '---\nstatus: draft\n---\n\n# Plan\n',
      '---\nstatus: draft\n---\n\n# Plan\n',
    )
    const host = renderRowsForTest(rows)
    expect(host.textContent).toContain('Front matter')
    expect(host.textContent).toContain('status: draft')
  })

  it('no-ops showRichView when the diff body is missing', () => {
    const empty = createFileRegion({
      path: 'docs/PLAN.md',
      includeDiffBody: false,
    })
    showRichView(empty, [])
    expect(empty.querySelector('[data-rgm-rich]')).toBeNull()
  })
})
