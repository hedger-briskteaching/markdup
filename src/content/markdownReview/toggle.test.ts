import { beforeEach, describe, expect, it } from 'vitest'
import { injectToggle } from './toggle'
import { createFileRegion } from './test/fixtures'

describe('injectToggle', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('hides the native File view control and inserts a Rich Markdown switch after it', () => {
    const region = createFileRegion({ path: 'docs/PLAN.md' })
    document.body.appendChild(region)

    injectToggle(region, 'docs/PLAN.md')

    const native = region.querySelector<HTMLElement>(
      'ul[data-component="SegmentedControl"][aria-label="File view"]',
    )
    const toggle = region.querySelector<HTMLElement>('[data-rgm-toggle]')
    const switchBtn = toggle?.querySelector<HTMLButtonElement>('[role="switch"]')

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
    const kebab = region.querySelector('button .octicon-kebab-horizontal')
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

  it('toggles rich stub and highlights the on state', () => {
    const region = createFileRegion({ path: 'docs/PLAN.md' })
    document.body.appendChild(region)
    injectToggle(region, 'docs/PLAN.md')

    const toggle = region.querySelector<HTMLElement>('[data-rgm-toggle]')!
    const switchBtn = toggle.querySelector<HTMLButtonElement>('[role="switch"]')!

    expect(switchBtn.getAttribute('aria-checked')).toBe('false')
    expect(toggle.getAttribute('data-rgm-mode')).toBe('source')

    switchBtn.click()
    expect(switchBtn.getAttribute('aria-checked')).toBe('true')
    expect(toggle.getAttribute('data-rgm-mode')).toBe('rich')
    expect(switchBtn.getAttribute('title')).toContain('Rich Markdown view is on')
    expect(region.getAttribute('data-rgm-mode')).toBe('rich')
    expect(region.querySelector('[data-rgm-stub]')).not.toBeNull()

    switchBtn.click()
    expect(switchBtn.getAttribute('aria-checked')).toBe('false')
    expect(toggle.getAttribute('data-rgm-mode')).toBe('source')
    expect(switchBtn.getAttribute('title')).toContain('Rich Markdown view is off')
    expect(region.hasAttribute('data-rgm-mode')).toBe(false)
    expect(region.querySelector('[data-rgm-stub]')).toBeNull()
  })
})
