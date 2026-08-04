import { afterEach, describe, expect, it, vi } from 'vitest'
import { alignMarkdown } from '../../markdown/align'
import type { ReviewThreadDto } from '../../shared/messages'
import { renderRowsForTest } from './richView'
import { setRichViewContext } from './selection'
import { renderThreadCards } from './threads'

const text = 'Alpha paragraph.\n\nBravo paragraph.\n'

function thread(line: number, rootId = 7): ReviewThreadDto {
  return {
    rootId,
    path: 'README.md',
    side: 'RIGHT',
    startLine: line,
    line,
    pending: false,
    comments: [
      {
        id: rootId,
        body: 'A note.',
        path: 'README.md',
        side: 'RIGHT',
        line,
        startLine: line,
        originalLine: null,
        inReplyToId: null,
        userLogin: 'hedger',
        createdAt: '2026-08-01T00:00:00Z',
        commitId: 'sha',
        htmlUrl: 'https://example.com',
        pullRequestReviewId: null,
      },
    ],
  }
}

function mountWithThread(): HTMLElement {
  const rows = alignMarkdown(text, text)
  const host = renderRowsForTest(rows, {
    baseText: text,
    headText: text,
    path: 'README.md',
  })
  document.body.appendChild(host)
  setRichViewContext(host, {
    baseText: text,
    headText: text,
    rows,
    path: 'README.md',
    threads: [thread(1)],
  })
  renderThreadCards(host)
  return host
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('commented text marks', () => {
  it('marks the commented cell with the thread id', () => {
    const host = mountWithThread()

    const marked = host.querySelector('.rgm-commented-cell')
    expect(marked).not.toBeNull()
    expect(marked?.getAttribute('data-rgm-commented-thread')).toBe('7')
    // Only the cell owning line 1 (Alpha) is marked, not Bravo.
    expect(host.querySelectorAll('.rgm-commented-cell')).toHaveLength(1)
    expect(marked?.textContent).toContain('Alpha')
  })

  it('clears marks when threads go away', () => {
    const host = mountWithThread()
    const ctx = {
      baseText: text,
      headText: text,
      rows: alignMarkdown(text, text),
      path: 'README.md',
      threads: [],
    }
    setRichViewContext(host, ctx)
    renderThreadCards(host)
    expect(host.querySelector('.rgm-commented-cell')).toBeNull()
  })
})

describe('thread card hover highlight', () => {
  it('highlights the targeted text on mouseenter and clears on mouseleave', () => {
    const host = mountWithThread()
    const card = host.querySelector<HTMLElement>('[data-rgm-thread-card]')!

    card.dispatchEvent(new Event('mouseenter'))
    const hovered = host.querySelector('.rgm-thread-hover-cell')
    expect(hovered).not.toBeNull()
    expect(hovered?.textContent).toContain('Alpha')

    card.dispatchEvent(new Event('mouseleave'))
    expect(host.querySelector('.rgm-thread-hover-cell')).toBeNull()
  })

  it('highlights on focusin and clears on focusout', () => {
    const host = mountWithThread()
    const card = host.querySelector<HTMLElement>('[data-rgm-thread-card]')!

    card.dispatchEvent(new Event('focusin'))
    expect(host.querySelector('.rgm-thread-hover-cell')).not.toBeNull()

    card.dispatchEvent(new Event('focusout'))
    expect(host.querySelector('.rgm-thread-hover-cell')).toBeNull()
  })
})

describe('click commented text → scroll to card', () => {
  it('scrolls to and flashes the thread card', () => {
    const scrollSpy = vi.fn()
    Element.prototype.scrollIntoView = scrollSpy

    const host = mountWithThread()
    const content = host.querySelector<HTMLElement>(
      '.rgm-commented-cell .rgm-rich-content',
    )!
    content.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    const card = host.querySelector<HTMLElement>('[data-rgm-thread-card]')!
    expect(scrollSpy).toHaveBeenCalled()
    expect(card.classList.contains('rgm-thread-card-flash')).toBe(true)
  })

  it('ignores clicks on text without comments', () => {
    const scrollSpy = vi.fn()
    Element.prototype.scrollIntoView = scrollSpy

    const host = mountWithThread()
    const cells = [
      ...host.querySelectorAll<HTMLElement>(
        '.rgm-rich-cell:not(.rgm-commented-cell) .rgm-rich-content',
      ),
    ]
    expect(cells.length).toBeGreaterThan(0)
    cells[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    const card = host.querySelector<HTMLElement>('[data-rgm-thread-card]')!
    expect(scrollSpy).not.toHaveBeenCalled()
    expect(card.classList.contains('rgm-thread-card-flash')).toBe(false)
  })
})
