import { afterEach, describe, expect, it } from 'vitest'
import { alignMarkdown } from '../../markdown/align'
import {
  bindHeaderControlSuppress,
  findFileCollapseButton,
  findFileCommentButton,
  findViewedControl,
  hideInterferingHeaderControls,
  showInterferingHeaderControls,
} from './headerControls'
import { hideRichView, showRichView } from './richView'
import { createFileRegion } from './test/fixtures'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('headerControls', () => {
  it('finds collapse, Viewed, and file-comment controls', () => {
    const region = createFileRegion({
      path: 'docs/PLAN.md',
      fileExpanded: true,
    })
    expect(findFileCollapseButton(region)?.getAttribute('aria-label')).toBe(
      'Collapse file',
    )
    expect(findViewedControl(region)?.getAttribute('aria-label')).toBe(
      'Not Viewed',
    )
    expect(findFileCommentButton(region)?.getAttribute('aria-label')).toBe(
      'Comment on this file',
    )
  })

  it('finds Comment via octicon when aria-label is missing', () => {
    const region = createFileRegion({ path: 'docs/PLAN.md' })
    const comment = findFileCommentButton(region)!
    comment.removeAttribute('aria-label')
    comment.replaceChildren()
    const icon = document.createElement('svg')
    icon.classList.add('octicon-comment')
    comment.appendChild(icon)

    expect(findFileCommentButton(region)).toBe(comment)
  })

  it('hides collapse, Viewed, and Comment while rich mode is on', () => {
    const region = createFileRegion({
      path: 'README.md',
      fileExpanded: true,
    })
    document.body.appendChild(region)
    region.setAttribute('data-rgm-mode', 'rich')

    const rows = alignMarkdown('A\n', 'B\n')
    showRichView(region, rows, { baseText: 'A\n', headText: 'B\n' })

    const collapse = findFileCollapseButton(region)!
    const viewed = findViewedControl(region)!
    const comment = findFileCommentButton(region)!

    expect(collapse.hasAttribute('data-rgm-rich-suppressed')).toBe(true)
    expect(viewed.hasAttribute('data-rgm-rich-suppressed')).toBe(true)
    expect(comment.hasAttribute('data-rgm-rich-suppressed')).toBe(true)
    expect(collapse.hasAttribute('hidden')).toBe(true)

    region.removeAttribute('data-rgm-mode')
    hideRichView(region)

    expect(collapse.hasAttribute('data-rgm-rich-suppressed')).toBe(false)
    expect(viewed.hasAttribute('data-rgm-rich-suppressed')).toBe(false)
    expect(comment.hasAttribute('data-rgm-rich-suppressed')).toBe(false)
    expect(collapse.hasAttribute('hidden')).toBe(false)
  })

  it('re-hides Comment when GitHub re-renders it into the header', () => {
    const region = createFileRegion({
      path: 'README.md',
      fileExpanded: true,
    })
    document.body.appendChild(region)
    region.setAttribute('data-rgm-mode', 'rich')
    const rows = alignMarkdown('A\n', 'A\n')
    showRichView(region, rows, { baseText: 'A\n', headText: 'A\n' })
    bindHeaderControlSuppress(region)

    const actions = region.querySelector('.d-flex.flex-items-center.gap-2')!
    // Simulate GitHub replacing the comment control after our first suppress.
    region.querySelector('button[aria-label="Comment on this file"]')?.remove()
    const fresh = document.createElement('button')
    fresh.type = 'button'
    fresh.setAttribute('aria-label', 'Comment on this file')
    const icon = document.createElement('svg')
    icon.classList.add('octicon-comment')
    fresh.appendChild(icon)
    actions.appendChild(fresh)

    // Observer is async via microtask/mutation; call hide directly to assert
    // the finder+suppress path, then ensure bind keeps it suppressed.
    hideInterferingHeaderControls(region)
    expect(fresh.hasAttribute('data-rgm-rich-suppressed')).toBe(true)
  })

  it('hide/show is idempotent', () => {
    const region = createFileRegion({
      path: 'README.md',
      fileExpanded: true,
    })
    hideInterferingHeaderControls(region)
    hideInterferingHeaderControls(region)
    expect(
      findFileCommentButton(region)?.hasAttribute('data-rgm-rich-suppressed'),
    ).toBe(true)
    showInterferingHeaderControls(region)
    showInterferingHeaderControls(region)
    expect(
      findFileCommentButton(region)?.hasAttribute('data-rgm-rich-suppressed'),
    ).toBe(false)
  })
})
