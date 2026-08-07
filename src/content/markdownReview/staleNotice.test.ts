import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { alignMarkdown } from '../../markdown/align'
import { markCommentsDirty, showStaleNoticeIfDirty } from './composer'
import { renderRichBody } from './renderBody'
import { renderRowsForTest } from './richView'
import { selectionToSourceRange } from './selection'
import { clearStaleNotice, showStaleNotice } from './staleNotice'

const NOTICE = '[data-rgm-stale-notice]'

/** Render a two-line file in the rich view and attach it to the document. */
function richHost(): HTMLElement {
  const text = 'Alpha line.\n\nBravo line.\n'
  const rows = alignMarkdown(text, text)
  const host = renderRowsForTest(rows, { baseText: text, headText: text })
  document.body.appendChild(host)
  return host
}

describe('showStaleNotice', () => {
  const original = window.location

  beforeEach(() => {
    document.body.innerHTML = ''
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: original,
    })
  })

  it('adds a notice at the top of the rich view', () => {
    const host = richHost()
    showStaleNotice(host)

    const notice = host.querySelector(NOTICE)
    expect(notice).not.toBeNull()
    expect(host.firstElementChild).toBe(notice)
    expect(notice?.textContent).toContain('Refresh page')
  })

  it('adds the notice only once across repeated mutations', () => {
    const host = richHost()
    showStaleNotice(host)
    showStaleNotice(host)
    showStaleNotice(host)

    expect(host.querySelectorAll(NOTICE)).toHaveLength(1)
  })

  it('reloads the page when Refresh is clicked', () => {
    const reload = vi.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload },
    })

    const host = richHost()
    showStaleNotice(host)
    host.querySelector<HTMLButtonElement>('.rgm-stale-notice-btn')?.click()

    expect(reload).toHaveBeenCalled()
  })

  it('marks the notice as chrome', () => {
    const host = richHost()
    showStaleNotice(host)

    expect(host.querySelector(NOTICE)?.hasAttribute('data-rgm-chrome')).toBe(
      true,
    )
  })

  it('survives a rich body re-render', () => {
    const host = richHost()
    showStaleNotice(host)
    renderRichBody(host)

    expect(host.querySelectorAll(NOTICE)).toHaveLength(1)
    expect(host.querySelector('.rgm-rich-body')).not.toBeNull()
  })

  it('leaves source line mapping untouched', () => {
    const host = richHost()
    showStaleNotice(host)

    const content = host.querySelector(
      '.rgm-rich-cell[data-side="RIGHT"][data-src-from="3"] [data-src-offset]',
    )
    const textNode = content?.firstChild
    expect(textNode).not.toBeNull()

    const range = document.createRange()
    range.setStart(textNode!, 0)
    range.setEnd(textNode!, 5)
    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)

    expect(selectionToSourceRange(selection, host)).toMatchObject({
      side: 'RIGHT',
      startLine: 3,
      endLine: 3,
    })
  })

  it('removes the notice on request', () => {
    const host = richHost()
    showStaleNotice(host)
    clearStaleNotice(host)

    expect(host.querySelector(NOTICE)).toBeNull()
  })
})

describe('markCommentsDirty', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    document.documentElement.removeAttribute('data-rgm-comments-dirty')
  })

  it('notices every open rich view, not only the edited file', () => {
    const edited = richHost()
    const other = richHost()

    markCommentsDirty(edited)

    expect(edited.querySelector(NOTICE)).not.toBeNull()
    expect(other.querySelector(NOTICE)).not.toBeNull()
  })

  it('notices a rich view mounted after the change', () => {
    markCommentsDirty(richHost())

    const later = richHost()
    expect(later.querySelector(NOTICE)).toBeNull()
    showStaleNoticeIfDirty(later)
    expect(later.querySelector(NOTICE)).not.toBeNull()
  })

  it('stays quiet while no comment change has landed', () => {
    const host = richHost()
    showStaleNoticeIfDirty(host)

    expect(host.querySelector(NOTICE)).toBeNull()
  })
})
