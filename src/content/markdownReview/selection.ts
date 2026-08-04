import type { BlockView, RowModel } from '../../markdown/align'
import type { ReviewThreadDto } from '../../shared/messages'
import {
  linesForRange,
  mergeSourceRanges,
  offsetsToSourceRange,
  type BlockSourceAnchor,
  type ReviewSide,
  type SourceRange,
} from '../../markdown/sourceRange'

export type { SourceRange, ReviewSide }

export type RichViewContext = {
  baseText: string
  headText: string
  rows: RowModel[]
  owner?: string
  repo?: string
  pullNumber?: number
  path?: string
  baseSha?: string
  headSha?: string
  threads?: ReviewThreadDto[]
}

const contexts = new WeakMap<Element, RichViewContext>()

/** Attach snapshot text + rows to the rich root for selection mapping. */
export function setRichViewContext(
  richRoot: Element,
  ctx: RichViewContext,
): void {
  contexts.set(richRoot, ctx)
}

export function clearRichViewContext(richRoot: Element): void {
  contexts.delete(richRoot)
}

export function getRichViewContext(
  richRoot: Element,
): RichViewContext | undefined {
  return contexts.get(richRoot)
}

/**
 * Map the current DOM selection inside a rich root to a source range.
 * Returns null when the selection is empty, crosses sides, or has no anchors.
 */
export function selectionToSourceRange(
  selection: Selection,
  richRoot: Element,
): SourceRange | null {
  if (selection.rangeCount === 0 || selection.isCollapsed) {
    return null
  }

  const range = selection.getRangeAt(0)
  if (!richRoot.contains(range.commonAncestorContainer)) {
    return null
  }

  const startCell = cellForNode(range.startContainer, richRoot)
  const endCell = cellForNode(range.endContainer, richRoot)
  if (!startCell || !endCell) {
    return null
  }

  const startSide = sideFromCell(startCell)
  const endSide = sideFromCell(endCell)
  if (!startSide || !endSide || startSide !== endSide) {
    return null
  }

  const ctx = contexts.get(richRoot)
  if (!ctx) {
    return null
  }

  const quotedText = normalizeQuoted(selection.toString())
  if (!quotedText) {
    return null
  }

  if (startCell === endCell) {
    const anchor = anchorFromCell(startCell, ctx)
    if (!anchor) return null
    const startOffset = srcOffsetInCell(startCell, range.startContainer, range.startOffset)
    const endOffset = srcOffsetInCell(startCell, range.endContainer, range.endOffset)
    if (startOffset == null || endOffset == null) return null
    return offsetsToSourceRange(anchor, startOffset, endOffset, quotedText)
  }

  // Multi-cell on the same side: span from first block start through last block end
  // using the selected offsets at each end.
  const startAnchor = anchorFromCell(startCell, ctx)
  const endAnchor = anchorFromCell(endCell, ctx)
  if (!startAnchor || !endAnchor) return null

  const startOffset = srcOffsetInCell(
    startCell,
    range.startContainer,
    range.startOffset,
  )
  const endOffset = srcOffsetInCell(endCell, range.endContainer, range.endOffset)
  if (startOffset == null || endOffset == null) return null

  const startRange = offsetsToSourceRange(
    startAnchor,
    startOffset,
    startAnchor.plainText.length,
    quotedText,
  )
  const endRange = offsetsToSourceRange(
    endAnchor,
    0,
    endOffset,
    quotedText,
  )
  return mergeSourceRanges(startRange, endRange)
}

function cellForNode(node: Node, richRoot: Element): HTMLElement | null {
  const el = node instanceof Element ? node : node.parentElement
  const cell = el?.closest<HTMLElement>('.rgm-rich-cell')
  if (!cell || !richRoot.contains(cell)) {
    return null
  }
  if (cell.classList.contains('rgm-rich-cell-missing')) {
    return null
  }
  return cell
}

function sideFromCell(cell: HTMLElement): ReviewSide | null {
  const side = cell.getAttribute('data-side')
  if (side === 'LEFT' || side === 'RIGHT') {
    return side
  }
  return null
}

function anchorFromCell(
  cell: HTMLElement,
  ctx: RichViewContext,
): BlockSourceAnchor | null {
  const side = sideFromCell(cell)
  const srcFrom = Number(cell.getAttribute('data-src-from'))
  const srcTo = Number(cell.getAttribute('data-src-to'))
  if (!side || !Number.isFinite(srcFrom) || !Number.isFinite(srcTo)) {
    return null
  }

  const blockId = cell.getAttribute('data-block-id')
  const block = blockId ? blockFromId(blockId, ctx.rows) : null
  const plainText =
    block != null
      ? plainTextForBlock(block)
      : (cell.querySelector('.rgm-rich-content')?.textContent ?? '')

  const fileText = side === 'LEFT' ? ctx.baseText : ctx.headText
  return {
    side,
    srcFrom,
    srcTo,
    plainText,
    sourceLines: linesForRange(fileText, srcFrom, srcTo),
  }
}

function blockFromId(blockId: string, rows: RowModel[]): BlockView | null {
  // blockId format: `${rowId}::before` | `${rowId}::after`
  const sep = blockId.lastIndexOf('::')
  if (sep < 0) return null
  const rowId = blockId.slice(0, sep)
  const which = blockId.slice(sep + 2)
  const row = rows.find((r) => r.id === rowId)
  if (!row) return null
  if (which === 'before') return row.old ?? null
  if (which === 'after') return row.new ?? null
  return null
}

function plainTextForBlock(block: BlockView): string {
  if (block.type === 'front_matter') {
    return String(block.node.attrs.value ?? '')
  }
  if (block.type === 'html_block') {
    return String(block.node.attrs.html ?? '')
  }
  return block.node.textContent
}

/**
 * Resolve a DOM point to an offset in the block's plain / source text.
 * Prefers `data-src-offset` segment maps; falls back to a text walk that
 * skips chrome (`data-rgm-chrome`).
 */
export function srcOffsetInCell(
  cell: HTMLElement,
  node: Node,
  offset: number,
): number | null {
  const content = cell.querySelector('.rgm-rich-content')
  if (!content || !content.contains(node) && node !== content) {
    // Click in gutter — treat as start of content
    if (cell.contains(node)) {
      return 0
    }
    return null
  }

  const marked = closestSrcOffsetHost(node, content)
  if (marked) {
    const base = Number(marked.getAttribute('data-src-offset'))
    if (!Number.isFinite(base)) return null
    const local = textOffsetWithin(marked, node, offset)
    return base + local
  }

  return walkTextOffset(content, node, offset)
}

function closestSrcOffsetHost(
  node: Node,
  content: Element,
): HTMLElement | null {
  let el: Element | null = node instanceof Element ? node : node.parentElement
  while (el && content.contains(el)) {
    if (el.hasAttribute('data-src-offset')) {
      return el as HTMLElement
    }
    if (el === content) break
    el = el.parentElement
  }
  return null
}

function textOffsetWithin(
  host: Element,
  target: Node,
  targetOffset: number,
): number {
  if (target === host) {
    return walkTextOffset(host, target, targetOffset) ?? 0
  }
  let total = 0
  const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT)
  let current = walker.nextNode()
  while (current) {
    if (isChromeText(current)) {
      current = walker.nextNode()
      continue
    }
    if (current === target) {
      return total + targetOffset
    }
    total += current.textContent?.length ?? 0
    current = walker.nextNode()
  }
  return total
}

function walkTextOffset(
  root: Element,
  target: Node,
  targetOffset: number,
): number | null {
  if (target === root) {
    // Element offset: count text in previous sibling children
    let total = 0
    for (let i = 0; i < targetOffset && i < root.childNodes.length; i++) {
      total += countableTextLength(root.childNodes[i]!)
    }
    return total
  }

  let total = 0
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let current = walker.nextNode()
  while (current) {
    if (isChromeText(current)) {
      current = walker.nextNode()
      continue
    }
    if (current === target) {
      return total + targetOffset
    }
    total += current.textContent?.length ?? 0
    current = walker.nextNode()
  }
  return null
}

function countableTextLength(node: Node): number {
  if (node instanceof Element && node.hasAttribute('data-rgm-chrome')) {
    return 0
  }
  if (node.nodeType === Node.TEXT_NODE) {
    if (isChromeText(node)) return 0
    return node.textContent?.length ?? 0
  }
  let total = 0
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT)
  let current = walker.nextNode()
  while (current) {
    if (!isChromeText(current)) {
      total += current.textContent?.length ?? 0
    }
    current = walker.nextNode()
  }
  return total
}

function isChromeText(node: Node): boolean {
  const el = node.parentElement
  return Boolean(el?.closest('[data-rgm-chrome]'))
}

function normalizeQuoted(text: string): string {
  return text.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
}
