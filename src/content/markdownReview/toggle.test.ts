import { beforeEach, describe, expect, it } from 'vitest'
import { injectToggle } from './toggle'
import { createFileRegion } from './test/fixtures'

describe('injectToggle', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('inserts the toggle immediately before the kebab button', () => {
    const region = createFileRegion({ path: 'docs/PLAN.md' })
    document.body.appendChild(region)

    injectToggle(region, 'docs/PLAN.md')

    const toggle = region.querySelector<HTMLButtonElement>('[data-rgm-toggle]')
    const kebab = region.querySelector('button .octicon-kebab-horizontal')
      ?.closest('button')

    expect(toggle).not.toBeNull()
    expect(toggle?.getAttribute('data-rgm-file')).toBe('docs/PLAN.md')
    expect(toggle?.getAttribute('aria-label')).toBe('Rich markdown view')
    expect(toggle?.getAttribute('aria-pressed')).toBe('false')
    expect(toggle?.nextElementSibling).toBe(kebab)
  })

  it('is idempotent', () => {
    const region = createFileRegion({ path: 'docs/PLAN.md' })
    document.body.appendChild(region)

    injectToggle(region, 'docs/PLAN.md')
    injectToggle(region, 'docs/PLAN.md')

    expect(region.querySelectorAll('[data-rgm-toggle]')).toHaveLength(1)
  })

  it('appends into the actions cluster when kebab is missing', () => {
    const region = createFileRegion({
      path: 'docs/PLAN.md',
      includeKebab: false,
    })
    document.body.appendChild(region)

    injectToggle(region, 'docs/PLAN.md')

    const actions = region.querySelector('.d-flex.flex-items-center.gap-2')
    const toggle = region.querySelector('[data-rgm-toggle]')
    expect(actions?.lastElementChild).toBe(toggle)
  })

  it('toggles rich stub and aria-pressed on click', () => {
    const region = createFileRegion({ path: 'docs/PLAN.md' })
    document.body.appendChild(region)
    injectToggle(region, 'docs/PLAN.md')

    const toggle = region.querySelector<HTMLButtonElement>('[data-rgm-toggle]')
    expect(toggle).not.toBeNull()

    toggle!.click()
    expect(toggle!.getAttribute('aria-pressed')).toBe('true')
    expect(region.getAttribute('data-rgm-mode')).toBe('rich')
    expect(region.querySelector('[data-rgm-stub]')).not.toBeNull()

    toggle!.click()
    expect(toggle!.getAttribute('aria-pressed')).toBe('false')
    expect(region.hasAttribute('data-rgm-mode')).toBe(false)
    expect(region.querySelector('[data-rgm-stub]')).toBeNull()
  })
})
