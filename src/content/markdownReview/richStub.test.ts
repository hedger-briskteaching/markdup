import { beforeEach, describe, expect, it } from 'vitest'
import {
  hideRichStub,
  isRichMode,
  setRichMode,
  showRichStub,
} from './richStub'
import { createFileRegion } from './test/fixtures'

describe('richStub', () => {
  let region: HTMLElement

  beforeEach(() => {
    document.body.innerHTML = ''
    region = createFileRegion({ path: 'docs/PLAN.md' })
    document.body.appendChild(region)
  })

  it('hides the native diff and inserts a two-column stub', () => {
    showRichStub(region)

    const diffBody = region.querySelector(
      'div.border.position-relative.rounded-bottom-2',
    )
    expect(diffBody?.hasAttribute('data-rgm-diff-hidden')).toBe(true)

    const stub = region.querySelector('[data-rgm-stub]')
    expect(stub).not.toBeNull()
    expect(stub?.querySelectorAll('.rgm-stub-pane')).toHaveLength(2)
    expect(stub?.textContent).toContain('Old')
    expect(stub?.textContent).toContain('New')
    expect(stub?.textContent).toContain('Rich markdown view (coming soon)')
    expect(diffBody?.nextElementSibling).toBe(stub)
  })

  it('does not duplicate the stub when shown twice', () => {
    showRichStub(region)
    showRichStub(region)
    expect(region.querySelectorAll('[data-rgm-stub]')).toHaveLength(1)
  })

  it('restores the native diff and removes the stub', () => {
    showRichStub(region)
    hideRichStub(region)

    const diffBody = region.querySelector(
      'div.border.position-relative.rounded-bottom-2',
    )
    expect(diffBody?.hasAttribute('data-rgm-diff-hidden')).toBe(false)
    expect(region.querySelector('[data-rgm-stub]')).toBeNull()
  })

  it('tracks rich mode via data-rgm-mode', () => {
    expect(isRichMode(region)).toBe(false)

    setRichMode(region, true)
    expect(isRichMode(region)).toBe(true)
    expect(region.getAttribute('data-rgm-mode')).toBe('rich')
    expect(region.querySelector('[data-rgm-stub]')).not.toBeNull()

    setRichMode(region, false)
    expect(isRichMode(region)).toBe(false)
    expect(region.hasAttribute('data-rgm-mode')).toBe(false)
    expect(region.querySelector('[data-rgm-stub]')).toBeNull()
  })

  it('no-ops showRichStub when the diff body is missing', () => {
    const empty = createFileRegion({
      path: 'docs/PLAN.md',
      includeDiffBody: false,
    })
    showRichStub(empty)
    expect(empty.querySelector('[data-rgm-stub]')).toBeNull()
  })
})
