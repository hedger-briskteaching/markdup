import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFileRegion, setPathname } from './test/fixtures'
import { resetAuthListenerForTests } from './toggle'

function stubChrome() {
  vi.stubGlobal('chrome', {
    runtime: {
      sendMessage: vi.fn(async () => ({ status: 'ok', login: 'tester' })),
      onMessage: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
  })
}

describe('initMarkdownReview', () => {
  const originalPushState = history.pushState.bind(history)
  const originalReplaceState = history.replaceState.bind(history)

  beforeEach(async () => {
    document.body.innerHTML = ''
    document.head.innerHTML = ''
    setPathname('/owner/repo/pull/1/changes')
    history.pushState = originalPushState
    history.replaceState = originalReplaceState
    vi.useFakeTimers()
    vi.resetModules()
    stubChrome()
    resetAuthListenerForTests()
    // init loads the scan module lazily. Warm the cache so a scan can finish
    // inside advanceTimersByTimeAsync instead of on a later real-time tick.
    await import('./enhance')
  })

  afterEach(async () => {
    const { resetInitForTests } = await import('./init')
    resetInitForTests()
    history.pushState = originalPushState
    history.replaceState = originalReplaceState
    vi.useRealTimers()
    vi.unstubAllGlobals()
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

  it('tears down styles when navigating away from the Files page', async () => {
    const md = createFileRegion({ path: 'docs/README.md' })
    document.body.appendChild(md)

    const { initMarkdownReview } = await import('./init')
    initMarkdownReview()
    await vi.advanceTimersByTimeAsync(100)

    expect(document.getElementById('rgm-markdown-review-styles')).not.toBeNull()

    setPathname('/owner/repo/pull/1')
    initMarkdownReview()
    await vi.advanceTimersByTimeAsync(100)

    expect(document.getElementById('rgm-markdown-review-styles')).toBeNull()
  })

  it('stays idle on the Conversation page until soft-navigating to Files', async () => {
    setPathname('/owner/repo/pull/1')
    const md = createFileRegion({ path: 'docs/README.md' })
    document.body.appendChild(md)

    const { initMarkdownReview } = await import('./init')
    initMarkdownReview()
    await vi.advanceTimersByTimeAsync(100)

    expect(document.getElementById('rgm-markdown-review-styles')).toBeNull()
    expect(md.querySelector('[data-rgm-toggle]')).toBeNull()

    setPathname('/owner/repo/pull/1/changes')
    document.dispatchEvent(new Event('turbo:load'))
    await vi.advanceTimersByTimeAsync(100)

    expect(document.getElementById('rgm-markdown-review-styles')).not.toBeNull()
    expect(md.querySelector('[data-rgm-toggle]')).not.toBeNull()
  })

  it('activates after starting on a page outside the PR routes', async () => {
    setPathname('/owner/repo/pulls')

    const { initMarkdownReview } = await import('./init')
    initMarkdownReview()
    await vi.advanceTimersByTimeAsync(100)

    expect(document.getElementById('rgm-markdown-review-styles')).toBeNull()

    setPathname('/owner/repo/pull/1')
    document.dispatchEvent(new Event('turbo:load'))
    await vi.advanceTimersByTimeAsync(100)

    expect(document.getElementById('rgm-markdown-review-styles')).toBeNull()

    setPathname('/owner/repo/pull/1/changes')
    const md = createFileRegion({ path: 'docs/README.md' })
    document.body.appendChild(md)
    document.dispatchEvent(new Event('turbo:load'))
    await vi.advanceTimersByTimeAsync(100)

    expect(document.getElementById('rgm-markdown-review-styles')).not.toBeNull()
    expect(md.querySelector('[data-rgm-toggle]')).not.toBeNull()
  })

  it('activates after a soft nav detected via DOM mutation', async () => {
    setPathname('/owner/repo/pull/1')

    const { initMarkdownReview } = await import('./init')
    initMarkdownReview()
    await vi.advanceTimersByTimeAsync(100)

    expect(document.getElementById('rgm-markdown-review-styles')).toBeNull()

    setPathname('/owner/repo/pull/1/changes')
    const md = createFileRegion({ path: 'docs/README.md' })
    document.body.appendChild(md)
    await vi.advanceTimersByTimeAsync(100)

    expect(document.getElementById('rgm-markdown-review-styles')).not.toBeNull()
    expect(md.querySelector('[data-rgm-toggle]')).not.toBeNull()
  })

  it('tears down after soft-navigating away from Files via turbo', async () => {
    const md = createFileRegion({ path: 'docs/README.md' })
    document.body.appendChild(md)

    const { initMarkdownReview } = await import('./init')
    initMarkdownReview()
    await vi.advanceTimersByTimeAsync(100)

    expect(document.getElementById('rgm-markdown-review-styles')).not.toBeNull()

    setPathname('/owner/repo/pull/1')
    document.dispatchEvent(new Event('turbo:load'))
    await vi.advanceTimersByTimeAsync(100)

    expect(document.getElementById('rgm-markdown-review-styles')).toBeNull()
  })
})
