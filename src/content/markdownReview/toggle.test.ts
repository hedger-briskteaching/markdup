import { beforeEach, describe, expect, it, vi } from 'vitest'
import { injectToggle, resetAuthListenerForTests } from './toggle'
import { createFileRegion, setPathname } from './test/fixtures'

const SAMPLE_SNAPSHOT = {
  owner: 'o',
  repo: 'r',
  pullNumber: 1,
  path: 'docs/PLAN.md',
  baseSha: 'aaa',
  headSha: 'bbb',
  baseText: '# Title\n\nOld line.\n',
  headText: '# Title\n\nNew line added.\n',
}

function mockAuthOk(login = 'tester') {
  vi.stubGlobal('chrome', {
    runtime: {
      sendMessage: vi.fn(async (message: { type: string }) => {
        if (message.type === 'AUTH_ENSURE') {
          return { status: 'ok', login }
        }
        if (message.type === 'AUTH_CANCEL') {
          return { ok: true }
        }
        if (message.type === 'FETCH_FILE_SNAPSHOT') {
          return SAMPLE_SNAPSHOT
        }
        if (message.type === 'FETCH_THREAD_INDEX') {
          return {
            owner: 'o',
            repo: 'r',
            pullNumber: 1,
            path: 'docs/PLAN.md',
            threads: [],
          }
        }
        return undefined
      }),
      onMessage: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
  })
}

function mockAuthNeedsCode() {
  const listeners: Array<(message: unknown) => void> = []
  vi.stubGlobal('chrome', {
    runtime: {
      sendMessage: vi.fn(async (message: { type: string }) => {
        if (message.type === 'AUTH_ENSURE') {
          return {
            status: 'needs_auth',
            user_code: 'WDJB-MJHT',
            verification_uri: 'https://github.com/login/device',
            expires_in: 900,
          }
        }
        if (message.type === 'AUTH_CANCEL') {
          return { ok: true }
        }
        if (message.type === 'FETCH_FILE_SNAPSHOT') {
          return SAMPLE_SNAPSHOT
        }
        if (message.type === 'FETCH_THREAD_INDEX') {
          return {
            owner: 'o',
            repo: 'r',
            pullNumber: 1,
            path: 'docs/PLAN.md',
            threads: [],
          }
        }
        return undefined
      }),
      onMessage: {
        addListener: vi.fn((listener: (message: unknown) => void) => {
          listeners.push(listener)
        }),
        removeListener: vi.fn(),
      },
    },
  })
  return {
    complete(login = 'tester') {
      for (const listener of listeners) {
        listener({ type: 'AUTH_COMPLETE', login })
      }
    },
  }
}

describe('injectToggle', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
    resetAuthListenerForTests()
    setPathname('/o/r/pull/1/changes')
    mockAuthOk()
  })

  it('hides the native File view control and inserts a Rich Markdown switch after it', () => {
    const region = createFileRegion({ path: 'docs/PLAN.md' })
    document.body.appendChild(region)

    injectToggle(region, 'docs/PLAN.md')

    const native = region.querySelector<HTMLElement>(
      'ul[data-component="SegmentedControl"][aria-label="File view"]',
    )
    const toggle = region.querySelector<HTMLElement>('[data-rgm-toggle]')
    const switchBtn =
      toggle?.querySelector<HTMLButtonElement>('[role="switch"]')

    expect(toggle).not.toBeNull()
    expect(toggle?.getAttribute('data-rgm-file')).toBe('docs/PLAN.md')
    expect(toggle?.getAttribute('data-rgm-mode')).toBe('source')
    expect(switchBtn?.getAttribute('aria-label')).toBe('Rich Markdown view')
    expect(switchBtn?.getAttribute('aria-checked')).toBe('false')
    expect(toggle?.textContent).toContain('Rich Markdown view')
    expect(switchBtn?.getAttribute('title')).toContain('source diff')
    expect(native?.hasAttribute('hidden')).toBe(true)
    expect(native?.hasAttribute('data-rgm-native-hidden')).toBe(true)
    expect(native?.nextElementSibling).toBe(toggle)
  })

  it('is idempotent', () => {
    const region = createFileRegion({ path: 'docs/PLAN.md' })
    document.body.appendChild(region)

    injectToggle(region, 'docs/PLAN.md')
    injectToggle(region, 'docs/PLAN.md')

    expect(region.querySelectorAll('[data-rgm-toggle]')).toHaveLength(1)
  })

  it('falls back before the kebab when native File view is missing', () => {
    const region = createFileRegion({
      path: 'docs/PLAN.md',
      includeFileViewToggle: false,
    })
    document.body.appendChild(region)

    injectToggle(region, 'docs/PLAN.md')

    const toggle = region.querySelector('[data-rgm-toggle]')
    const kebab = region
      .querySelector('button .octicon-kebab-horizontal')
      ?.closest('button')

    expect(toggle?.nextElementSibling).toBe(kebab)
  })

  it('appends into the actions cluster when kebab and native are missing', () => {
    const region = createFileRegion({
      path: 'docs/PLAN.md',
      includeKebab: false,
      includeFileViewToggle: false,
    })
    document.body.appendChild(region)

    injectToggle(region, 'docs/PLAN.md')

    const actions = region.querySelector('.d-flex.flex-items-center.gap-2')
    const toggle = region.querySelector('[data-rgm-toggle]')
    expect(actions?.lastElementChild).toBe(toggle)
  })

  it('enables rich mode after auth succeeds', async () => {
    const region = createFileRegion({ path: 'docs/PLAN.md' })
    document.body.appendChild(region)
    injectToggle(region, 'docs/PLAN.md')

    const toggle = region.querySelector<HTMLElement>('[data-rgm-toggle]')!
    const switchBtn = toggle.querySelector<HTMLButtonElement>('[role="switch"]')!

    switchBtn.click()
    await vi.waitFor(() => {
      expect(switchBtn.getAttribute('aria-checked')).toBe('true')
    })

    expect(toggle.getAttribute('data-rgm-mode')).toBe('rich')
    expect(region.getAttribute('data-rgm-mode')).toBe('rich')
    await vi.waitFor(() => {
      expect(region.querySelector('[data-rgm-rich]')).not.toBeNull()
    })
    expect(region.textContent).toContain('Before')
    expect(region.textContent).toContain('New line')

    switchBtn.click()
    expect(switchBtn.getAttribute('aria-checked')).toBe('false')
    expect(region.querySelector('[data-rgm-rich]')).toBeNull()
  })

  it('shows connect panel when auth is required and enables after AUTH_COMPLETE', async () => {
    vi.unstubAllGlobals()
    resetAuthListenerForTests()
    setPathname('/o/r/pull/1/changes')
    const auth = mockAuthNeedsCode()

    const region = createFileRegion({ path: 'docs/PLAN.md' })
    document.body.appendChild(region)
    injectToggle(region, 'docs/PLAN.md')

    const toggle = region.querySelector<HTMLElement>('[data-rgm-toggle]')!
    const switchBtn = toggle.querySelector<HTMLButtonElement>('[role="switch"]')!

    switchBtn.click()

    await vi.waitFor(() => {
      expect(region.querySelector('[data-rgm-auth-panel]')).not.toBeNull()
    })

    expect(switchBtn.getAttribute('aria-checked')).toBe('false')
    expect(region.querySelector('[data-rgm-rich]')).toBeNull()
    expect(region.textContent).toContain('WDJB-MJHT')

    auth.complete('alice')

    await vi.waitFor(() => {
      expect(switchBtn.getAttribute('aria-checked')).toBe('true')
    })
    expect(region.querySelector('[data-rgm-auth-panel]')).toBeNull()
    await vi.waitFor(() => {
      expect(region.querySelector('[data-rgm-rich]')).not.toBeNull()
    })
  })
})
