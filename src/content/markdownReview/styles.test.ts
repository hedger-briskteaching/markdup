import { beforeEach, describe, expect, it } from 'vitest'
import { injectStyles } from './styles'

describe('injectStyles', () => {
  beforeEach(() => {
    document.head.innerHTML = ''
  })

  it('injects stylesheet into document.head once', () => {
    injectStyles()
    injectStyles()

    const styles = document.querySelectorAll('#rgm-markdown-review-styles')
    expect(styles).toHaveLength(1)
    expect(styles[0]?.textContent).toContain('[data-rgm-toggle]')
    expect(styles[0]?.textContent).toContain('[data-rgm-stub]')
  })
})
