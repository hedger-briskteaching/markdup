import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { alignMarkdown } from '../../markdown/align'
import type { ReviewThreadDto } from '../../shared/messages'
import type { SourceRange } from '../../markdown/sourceRange'
import { renderRowsForTest } from './richView'
import {
  applySelectionHighlight,
  bindOverlayRepaint,
  repaintOverlays,
  selectionToSourceRange,
  setRichViewContext,
  snapDomSelectionToSourceRange,
} from './selection'
import { renderThreadCards } from './threads'

function selectTextIn(
  root: Element,
  side: 'before' | 'after',
  needle: string,
): Selection {
  const cells = [
    ...root.querySelectorAll(`.rgm-rich-cell-${side} .rgm-rich-content`),
  ]
  expect(cells.length).toBeGreaterThan(0)

  for (const content of cells) {
    const parts: { node: Text; text: string }[] = []
    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT)
    let node = walker.nextNode()
    while (node) {
      if (!node.parentElement?.closest('[data-rgm-chrome]')) {
        parts.push({ node: node as Text, text: node.textContent ?? '' })
      }
      node = walker.nextNode()
    }

    const joined = parts.map((p) => p.text).join('')
    const start = joined.indexOf(needle)
    if (start < 0) continue

    const end = start + needle.length
    let seen = 0
    let startNode: Text | null = null
    let startOffset = 0
    let endNode: Text | null = null
    let endOffset = 0

    for (const part of parts) {
      const next = seen + part.text.length
      if (startNode == null && start < next) {
        startNode = part.node
        startOffset = start - seen
      }
      if (end <= next) {
        endNode = part.node
        endOffset = end - seen
        break
      }
      seen = next
    }

    if (!startNode || !endNode) continue

    const range = document.createRange()
    range.setStart(startNode, startOffset)
    range.setEnd(endNode, endOffset)
    const selection = window.getSelection()
    expect(selection).not.toBeNull()
    selection!.removeAllRanges()
    selection!.addRange(range)
    return selection!
  }

  throw new Error(`Needle not found in ${side}: ${needle}`)
}

/**
 * Stand in for layout, which jsdom does not do, by reporting one rect per
 * range. Returns a function that restores the original implementation.
 */
function stubRangeRects(rectFor: (range: Range) => DOMRect): () => void {
  const proto = Range.prototype as unknown as {
    getClientRects?: () => DOMRectList
  }
  const original = proto.getClientRects
  proto.getClientRects = function (this: Range) {
    return [rectFor(this)] as unknown as DOMRectList
  }
  return () => {
    if (original) {
      proto.getClientRects = original
    } else {
      delete proto.getClientRects
    }
  }
}

/** Build a rect at a given vertical offset. */
function rectAt(top: number): DOMRect {
  return { top, left: 0, width: 10, height: 10 } as unknown as DOMRect
}

/** Run a highlight pass and report the text each painted box covers. */
function textCoveredByHighlight(run: () => void): string {
  const covered: string[] = []
  const restore = stubRangeRects((range) => {
    covered.push(range.toString())
    return rectAt(0)
  })
  try {
    run()
  } finally {
    restore()
  }
  return covered.join('\n')
}

describe('selectionToSourceRange', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('maps an After selection to whole RIGHT source lines', () => {
    const baseText = '# Title\n\nOld text.\n'
    const headText = '# Title\n\nNew text here.\n'
    const rows = alignMarkdown(baseText, headText)
    const host = renderRowsForTest(rows, { baseText, headText })
    document.body.appendChild(host)

    const selection = selectTextIn(host, 'after', 'New text')
    const range = selectionToSourceRange(selection, host)

    expect(range).toEqual({
      side: 'RIGHT',
      startLine: 3,
      startCol: 1,
      endLine: 3,
      endCol: 15,
      quotedText: 'New text here.',
    })
  })

  it('maps a Before heading selection to the whole source line', () => {
    const baseText = '# Title\n\nBody.\n'
    const headText = '# Title\n\nBody.\n'
    const rows = alignMarkdown(baseText, headText)
    const host = renderRowsForTest(rows, { baseText, headText })
    document.body.appendChild(host)

    const selection = selectTextIn(host, 'before', 'Title')
    const range = selectionToSourceRange(selection, host)

    expect(range).toEqual({
      side: 'LEFT',
      startLine: 1,
      startCol: 1,
      endLine: 1,
      endCol: 8,
      quotedText: '# Title',
    })
  })

  it('returns null for a collapsed selection', () => {
    const text = 'Hello.\n'
    const rows = alignMarkdown(text, text)
    const host = renderRowsForTest(rows, { baseText: text, headText: text })
    document.body.appendChild(host)

    const cell = host.querySelector('.rgm-rich-content')
    const textNode = cell?.querySelector('[data-src-offset]')?.firstChild
    expect(textNode).not.toBeNull()
    const range = document.createRange()
    range.setStart(textNode!, 0)
    range.collapse(true)
    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)

    expect(selectionToSourceRange(selection, host)).toBeNull()
  })

  it('returns null when selection crosses Before and After', () => {
    const baseText = 'Same line.\n'
    const headText = 'Same line.\n'
    const rows = alignMarkdown(baseText, headText)
    const host = renderRowsForTest(rows, { baseText, headText })
    document.body.appendChild(host)

    const before = host.querySelector(
      '.rgm-rich-cell-before [data-src-offset]',
    )
    const after = host.querySelector(
      '.rgm-rich-cell-after [data-src-offset]',
    )
    expect(before?.firstChild).not.toBeNull()
    expect(after?.firstChild).not.toBeNull()

    const range = document.createRange()
    range.setStart(before!.firstChild!, 0)
    range.setEnd(after!.firstChild!, 4)
    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)

    expect(selectionToSourceRange(selection, host)).toBeNull()
  })

  it('maps a word-diff segment selection to the whole source line', () => {
    const baseText = 'Hello world.\n'
    const headText = 'Hello brave world.\n'
    const rows = alignMarkdown(baseText, headText)
    const host = renderRowsForTest(rows, { baseText, headText })
    document.body.appendChild(host)

    const ins = host.querySelector('.rgm-rich-ins')
    expect(ins?.textContent).toContain('brave')
    expect(ins?.getAttribute('data-src-offset')).toBe('6')

    const selection = selectTextIn(host, 'after', 'brave')
    const range = selectionToSourceRange(selection, host)
    expect(range).toEqual({
      side: 'RIGHT',
      startLine: 1,
      startCol: 1,
      endLine: 1,
      endCol: 19,
      quotedText: 'Hello brave world.',
    })
  })

  it('snaps the DOM selection and paints a highlight for whole lines', () => {
    const baseText = 'Hello world.\n'
    const headText = 'Hello brave world.\n'
    const rows = alignMarkdown(baseText, headText)
    const host = renderRowsForTest(rows, { baseText, headText })
    document.body.appendChild(host)

    const selection = selectTextIn(host, 'after', 'brave')
    const range = selectionToSourceRange(selection, host)
    expect(range).not.toBeNull()

    const snapped = snapDomSelectionToSourceRange(selection, host, range!)
    expect(snapped).not.toBeNull()
    expect(selection.toString()).toContain('Hello')
    expect(selection.toString()).toContain('brave')

    applySelectionHighlight(host, range!)
    expect(host.querySelector('[data-rgm-sel-highlight]')).not.toBeNull()
    expect(host.querySelector('.rgm-sel-highlight-cell')).not.toBeNull()
  })

  it('maps a soft-wrapped selection to the matching source line', () => {
    // One paragraph soft-wrapped across two source lines.
    const baseText = 'hello\nworld\n'
    const headText = 'hello\nworld\n'
    const rows = alignMarkdown(baseText, headText)
    const host = renderRowsForTest(rows, { baseText, headText })
    document.body.appendChild(host)

    const selection = selectTextIn(host, 'after', 'world')
    const range = selectionToSourceRange(selection, host)
    expect(range).toEqual({
      side: 'RIGHT',
      startLine: 2,
      startCol: 1,
      endLine: 2,
      endCol: 6,
      quotedText: 'world',
    })
  })

  it("keeps the user's source lines (does not jump to distant commentable hunks)", () => {
    const baseText = 'Alpha beta\ngamma delta\n'
    const headText = 'Alpha beta\ngamma delta\n'
    const rows = alignMarkdown(baseText, headText)
    const host = renderRowsForTest(rows, {
      baseText,
      headText,
      commentable: {
        left: new Set(),
        // Only line 1 is commentable — selecting "gamma" must stay on line 2.
        right: new Set([1]),
      },
    })
    document.body.appendChild(host)

    const selection = selectTextIn(host, 'after', 'gamma')
    const range = selectionToSourceRange(selection, host)
    expect(range).toMatchObject({
      side: 'RIGHT',
      startLine: 2,
      endLine: 2,
    })
  })
})

/** Three-block file with one thread on the middle block, cards rendered. */
function hostWithThread(): HTMLElement {
  const baseText = 'Alpha.\n\nBravo.\n\nCharlie.\n'
  const headText = 'Alpha one.\n\nBravo two.\n\nCharlie three.\n'
  const rows = alignMarkdown(baseText, headText)
  const host = renderRowsForTest(rows, {
    baseText,
    headText,
    path: 'docs/PLAN.md',
  })
  document.body.appendChild(host)

  const comment: ReviewThreadDto = {
    path: 'docs/PLAN.md',
    rootId: 7,
    side: 'RIGHT',
    startLine: 3,
    line: 3,
    pending: false,
    comments: [
      {
        id: 7,
        body: 'Needs a rewrite.',
        path: 'docs/PLAN.md',
        side: 'RIGHT',
        line: 3,
        startLine: 3,
        originalLine: null,
        inReplyToId: null,
        userLogin: 'jgable',
        createdAt: new Date().toISOString(),
        commitId: 'abc',
        htmlUrl: 'https://github.com/o/r/pull/1#discussion_r7',
        pullRequestReviewId: null,
      },
    ],
  }
  setRichViewContext(host, {
    baseText,
    headText,
    rows,
    path: 'docs/PLAN.md',
    threads: [comment],
  })
  renderThreadCards(host)
  return host
}

/** Source range spanning all three blocks of the hostWithThread fixture. */
const WHOLE_FILE: SourceRange = {
  side: 'RIGHT',
  startLine: 1,
  startCol: 1,
  endLine: 5,
  endCol: 15,
  quotedText: 'Alpha one.',
}

describe('applySelectionHighlight', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('skips thread cards sitting between the selected blocks', () => {
    const host = hostWithThread()
    expect(host.querySelector('[data-rgm-thread-card]')?.textContent).toContain(
      'Needs a rewrite.',
    )

    const covered = textCoveredByHighlight(() => {
      applySelectionHighlight(host, WHOLE_FILE)
    })

    expect(covered).toContain('Alpha one.')
    expect(covered).toContain('Charlie three.')
    expect(covered).not.toContain('Needs a rewrite.')
  })
})

describe('repaintOverlays', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('moves painted boxes to where the text is now', () => {
    let top = 10
    const restore = stubRangeRects(() => rectAt(top))
    try {
      const host = hostWithThread()
      applySelectionHighlight(host, WHOLE_FILE)

      const boxTops = () =>
        [
          ...host.querySelectorAll<HTMLElement>(
            '.rgm-commented-box, .rgm-sel-highlight',
          ),
        ].map((box) => box.style.top)
      expect(boxTops().length).toBeGreaterThan(1)
      expect(new Set(boxTops())).toEqual(new Set(['10px']))

      // A reply editor opening pushes every block below it down.
      top = 210
      repaintOverlays(host)
      expect(new Set(boxTops())).toEqual(new Set(['210px']))
    } finally {
      restore()
    }
  })

  it('does nothing when no layer is painted', () => {
    const host = hostWithThread()
    host.querySelector('[data-rgm-commented-layer]')?.remove()
    repaintOverlays(host)
    expect(host.querySelector('[data-rgm-sel-highlight]')).toBeNull()
  })

  it('repaints when a resize observer reports a reflow', async () => {
    let top = 10
    const restore = stubRangeRects(() => rectAt(top))
    const disconnect = vi.fn()
    let notify: (() => void) | null = null

    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          notify = callback
        }
        observe() {}
        unobserve() {}
        disconnect() {
          disconnect()
        }
      },
    )

    try {
      const host = hostWithThread()
      const cleanup = bindOverlayRepaint(host)
      const box = () =>
        host.querySelector<HTMLElement>('.rgm-commented-box')!
      expect(box().style.top).toBe('10px')

      top = 210
      notify?.()
      await new Promise((resolve) => requestAnimationFrame(resolve))
      expect(box().style.top).toBe('210px')

      cleanup()
      expect(disconnect).toHaveBeenCalled()
    } finally {
      restore()
    }
  })
})
