import { beforeEach, describe, expect, it } from 'vitest'
import { injectStyles, removeStyles } from './styles'

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
    expect(styles[0]?.textContent).toContain('[data-rgm-nux]')
    expect(styles[0]?.textContent).toContain('[data-rgm-stub]')
  })

  it('removeStyles clears the injected stylesheet', () => {
    injectStyles()
    removeStyles()
    expect(document.getElementById('rgm-markdown-review-styles')).toBeNull()
  })
})
