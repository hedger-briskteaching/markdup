import { beforeEach, describe, expect, it } from 'vitest'
import { alignMarkdown } from '../../markdown/align'
import { renderRowsForTest } from './richView'
import {
  applySelectionHighlight,
  selectionToSourceRange,
  snapDomSelectionToSourceRange,
} from './selection'

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
