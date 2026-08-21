import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { alignMarkdown } from '../../markdown/align'
import { applyRichLayout } from './layout'
import { clearRichPathIntents } from './richIntent'
import { hideRichView, showRichView } from './richView'
import { createFileRegion } from './test/fixtures'

describe('rich diff layout selector', () => {
  let region: HTMLElement

  beforeEach(() => {
    document.body.innerHTML = ''
    clearRichPathIntents()
    region = createFileRegion({ path: 'docs/PLAN.md' })
    document.body.appendChild(region)
  })

  afterEach(() => {
    document.body.innerHTML = ''
    clearRichPathIntents()
  })

  it('changes layout without rebuilding the rich columns', () => {
    const rows = alignMarkdown('Before text\n', 'After text\n')
    showRichView(region, rows, {
      baseText: 'Before text\n',
      headText: 'After text\n',
      path: 'docs/PLAN.md',
    })

    const root = region.querySelector<HTMLElement>('[data-rgm-rich]')!
    const before = root.querySelector<HTMLElement>(
      '.rgm-rich-cell[data-side="LEFT"]',
    )!
    const after = root.querySelector<HTMLElement>(
      '.rgm-rich-cell[data-side="RIGHT"]',
    )!
    const editor = document.createElement('textarea')
    after.appendChild(editor)
    editor.focus()

    applyRichLayout(root, 'before')

    expect(root.getAttribute('data-rgm-layout')).toBe('before')
    expect(root.querySelector('.rgm-rich-cell[data-side="LEFT"]')).toBe(before)
    expect(root.querySelector('.rgm-rich-cell[data-side="RIGHT"]')).toBe(after)
    expect(after.contains(editor)).toBe(true)
    expect(document.activeElement).not.toBe(editor)
    expect(
      root
        .querySelector('[data-rgm-layout-option="before"]')
        ?.getAttribute('aria-pressed'),
    ).toBe('true')
    expect(
      root
        .querySelector('[data-rgm-layout-option="split"]')
        ?.getAttribute('aria-pressed'),
    ).toBe('false')
  })

  it('labels each option with data-tooltip rather than the slow title', () => {
    const rows = alignMarkdown('Before text\n', 'After text\n')
    showRichView(region, rows, {
      baseText: 'Before text\n',
      headText: 'After text\n',
      path: 'docs/PLAN.md',
    })

    const buttons = [
      ...region.querySelectorAll<HTMLButtonElement>('[data-rgm-layout-option]'),
    ]
    expect(buttons).toHaveLength(3)
    for (const button of buttons) {
      expect(button.getAttribute('title')).toBeNull()
      expect(button.getAttribute('data-tooltip')?.length).toBeGreaterThan(0)
      expect(button.getAttribute('data-tooltip')).toBe(
        button.getAttribute('aria-label'),
      )
    }
  })

  it('restores the selected layout when the rich view remounts', () => {
    const rows = alignMarkdown('Before text\n', 'After text\n')
    const options = {
      baseText: 'Before text\n',
      headText: 'After text\n',
      path: 'docs/PLAN.md',
    }
    showRichView(region, rows, options)
    const root = region.querySelector<HTMLElement>('[data-rgm-rich]')!
    applyRichLayout(root, 'after')

    hideRichView(region)
    showRichView(region, rows, options)

    const remounted = region.querySelector<HTMLElement>('[data-rgm-rich]')!
    expect(remounted.getAttribute('data-rgm-layout')).toBe('after')
    expect(
      remounted
        .querySelector('[data-rgm-layout-option="after"]')
        ?.getAttribute('aria-pressed'),
    ).toBe('true')
  })
})
