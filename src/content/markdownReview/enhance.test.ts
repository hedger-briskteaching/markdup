import { beforeEach, describe, expect, it, vi } from 'vitest'
import { enhanceMarkdownRegions } from './enhance'
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

describe('enhanceMarkdownRegions', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    document.head.innerHTML = ''
    setPathname('/owner/repo/pull/1/changes')
    resetAuthListenerForTests()
    stubChrome()
  })

  it('injects toggles only for markdown file regions', () => {
    const md = createFileRegion({ path: 'docs/PLAN.md' })
    const ts = createFileRegion({ path: 'src/main.ts' })
    document.body.append(md, ts)

    enhanceMarkdownRegions()

    expect(md.querySelector('[data-rgm-toggle]')).not.toBeNull()
    expect(ts.querySelector('[data-rgm-toggle]')).toBeNull()
  })

  it('injects toggles when header paths are wrapped in GitHub bidi marks', () => {
    const a = createFileRegion({
      path: 'docs/A.md',
      pathViaLinkOnly: true,
    })
    const b = createFileRegion({
      path: 'docs/B.md',
      pathViaLinkOnly: true,
    })
    for (const region of [a, b]) {
      const link = region.querySelector('h3 a')!
      link.textContent = `\u200e${link.textContent}\u200e`
    }
    document.body.append(a, b)

    enhanceMarkdownRegions()

    expect(a.querySelector('[data-rgm-toggle]')).not.toBeNull()
    expect(b.querySelector('[data-rgm-toggle]')).not.toBeNull()
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
