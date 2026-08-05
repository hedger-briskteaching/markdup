import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  dismissToggleNux,
  maybeShowToggleNux,
  NUX_TOGGLE_VISITED_KEY,
  resetToggleNuxForTests,
} from './nux'

type StorageStore = Record<string, unknown>

function mockStorage(initial: StorageStore = {}) {
  const store: StorageStore = { ...initial }
  const local = {
    get: vi.fn(async (key: string) => {
      return { [key]: store[key] }
    }),
    set: vi.fn(async (values: StorageStore) => {
      Object.assign(store, values)
    }),
  }
  vi.stubGlobal('chrome', { storage: { local } })
  return { store, local }
}

describe('maybeShowToggleNux', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
    resetToggleNuxForTests()
  })

  it('shows a popup on the first toggle and marks storage visited', async () => {
    const { store, local } = mockStorage()
    const toggle = document.createElement('div')
    document.body.appendChild(toggle)

    await maybeShowToggleNux(toggle)

    const popup = toggle.querySelector('[data-rgm-nux]')
    expect(popup).not.toBeNull()
    expect(popup?.textContent).toContain(
      'review markdown files in rich text format',
    )
    expect(popup?.getAttribute('role')).toBe('status')
    expect(local.set).toHaveBeenCalledWith({ [NUX_TOGGLE_VISITED_KEY]: true })
    expect(store[NUX_TOGGLE_VISITED_KEY]).toBe(true)
  })

  it('does not show again when storage already marks visited', async () => {
    mockStorage({ [NUX_TOGGLE_VISITED_KEY]: true })
    const toggle = document.createElement('div')
    document.body.appendChild(toggle)

    await maybeShowToggleNux(toggle)

    expect(toggle.querySelector('[data-rgm-nux]')).toBeNull()
  })

  it('only shows on the first mounted toggle in a session', async () => {
    mockStorage()
    const first = document.createElement('div')
    const second = document.createElement('div')
    document.body.appendChild(first)
    document.body.appendChild(second)

    await Promise.all([
      maybeShowToggleNux(first),
      maybeShowToggleNux(second),
    ])

    expect(document.querySelectorAll('[data-rgm-nux]')).toHaveLength(1)
    expect(first.querySelector('[data-rgm-nux]')).not.toBeNull()
    expect(second.querySelector('[data-rgm-nux]')).toBeNull()
  })

  it('dismisses when Got it is clicked', async () => {
    mockStorage()
    const toggle = document.createElement('div')
    document.body.appendChild(toggle)

    await maybeShowToggleNux(toggle)
    const dismiss = toggle.querySelector<HTMLButtonElement>('.rgm-nux-dismiss')
    expect(dismiss?.textContent).toBe('Got it')
    dismiss?.click()

    expect(toggle.querySelector('[data-rgm-nux]')).toBeNull()
  })

  it('skips when chrome.storage is unavailable', async () => {
    vi.stubGlobal('chrome', {})
    const toggle = document.createElement('div')
    document.body.appendChild(toggle)

    await maybeShowToggleNux(toggle)

    expect(toggle.querySelector('[data-rgm-nux]')).toBeNull()
  })

  it('dismissToggleNux removes an open popup', async () => {
    mockStorage()
    const toggle = document.createElement('div')
    document.body.appendChild(toggle)
    await maybeShowToggleNux(toggle)
    expect(toggle.querySelector('[data-rgm-nux]')).not.toBeNull()

    dismissToggleNux()
    expect(document.querySelector('[data-rgm-nux]')).toBeNull()
  })
})
