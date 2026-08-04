import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enhanceMarkdownRegions } from './init'
import { createFileRegion, setPathname } from './test/fixtures'

describe('enhanceMarkdownRegions', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    document.head.innerHTML = ''
    setPathname('/owner/repo/pull/1/changes')
  })

  it('injects toggles only for markdown file regions', () => {
    const md = createFileRegion({ path: 'docs/PLAN.md' })
    const ts = createFileRegion({ path: 'src/main.ts' })
    document.body.append(md, ts)

    enhanceMarkdownRegions()

    expect(md.querySelector('[data-rgm-toggle]')).not.toBeNull()
    expect(ts.querySelector('[data-rgm-toggle]')).toBeNull()
  })

  it('does nothing off the PR files page', () => {
    setPathname('/owner/repo/pull/1')
    const md = createFileRegion({ path: 'docs/PLAN.md' })
    document.body.appendChild(md)

    enhanceMarkdownRegions()

    expect(md.querySelector('[data-rgm-toggle]')).toBeNull()
  })

  it('skips regions that already have a toggle', () => {
    const md = createFileRegion({ path: 'docs/PLAN.md' })
    document.body.appendChild(md)

    enhanceMarkdownRegions()
    enhanceMarkdownRegions()

    expect(md.querySelectorAll('[data-rgm-toggle]')).toHaveLength(1)
  })
})

describe('initMarkdownReview', () => {
  const originalPushState = history.pushState.bind(history)
  const originalReplaceState = history.replaceState.bind(history)

  beforeEach(() => {
    document.body.innerHTML = ''
    document.head.innerHTML = ''
    setPathname('/owner/repo/pull/1/changes')
    history.pushState = originalPushState
    history.replaceState = originalReplaceState
    vi.useFakeTimers()
    vi.resetModules()
  })

  afterEach(() => {
    history.pushState = originalPushState
    history.replaceState = originalReplaceState
    vi.useRealTimers()
  })

  it('injects styles and enhances markdown regions on start', async () => {
    const md = createFileRegion({ path: 'docs/README.md' })
    document.body.appendChild(md)

    const { initMarkdownReview } = await import('./init')
    initMarkdownReview()
    await vi.advanceTimersByTimeAsync(100)

    expect(document.getElementById('rgm-markdown-review-styles')).not.toBeNull()
    expect(md.querySelector('[data-rgm-toggle]')).not.toBeNull()
  })

  it('is safe to call more than once', async () => {
    const md = createFileRegion({ path: 'docs/README.md' })
    document.body.appendChild(md)

    const { initMarkdownReview } = await import('./init')
    initMarkdownReview()
    initMarkdownReview()
    await vi.advanceTimersByTimeAsync(100)

    expect(md.querySelectorAll('[data-rgm-toggle]')).toHaveLength(1)
    expect(
      document.querySelectorAll('#rgm-markdown-review-styles'),
    ).toHaveLength(1)
  })

  it('re-scans when new file regions are added', async () => {
    const list = document.createElement('div')
    list.setAttribute('data-testid', 'progressive-diffs-list')
    document.body.appendChild(list)

    const { initMarkdownReview } = await import('./init')
    initMarkdownReview()
    await vi.advanceTimersByTimeAsync(100)

    const md = createFileRegion({ path: 'notes/TODO.md' })
    list.appendChild(md)
    await vi.advanceTimersByTimeAsync(100)

    expect(md.querySelector('[data-rgm-toggle]')).not.toBeNull()
  })
})
