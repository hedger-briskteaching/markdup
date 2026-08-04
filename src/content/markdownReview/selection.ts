import type { BlockView, RowModel } from '../../markdown/align'
import type { ReviewThreadDto } from '../../shared/messages'
import type { CommentableLines } from '../../shared/commentableLines'
import {
  expandSourceRangeToWholeLines,
  linesForRange,
  mergeSourceRanges,
  offsetsToSourceRange,
  plainOffsetsForLineSpan,
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
  /** Empty sets = unknown (no patch). */
  commentable?: CommentableLines
  /**
   * Unchanged section ids that are currently expanded.
   * Default empty = all unchanged sections start collapsed.
   */
  expandedUnchangedIds?: Set<string>
}

const contexts = new WeakMap<Element, RichViewContext>()
const HIGHLIGHT_ATTR = 'data-rgm-sel-highlight'

/** Attach snapshot text + rows to the rich root for selection mapping. */
export function setRichViewContext(
  richRoot: Element,
  ctx: RichViewContext,
): void {
  contexts.set(richRoot, {
    ...ctx,
    expandedUnchangedIds: ctx.expandedUnchangedIds ?? new Set(),
  })
}

export function clearRichViewContext(richRoot: Element): void {
  contexts.delete(richRoot)
}

export function getRichViewContext(
  richRoot: Element,
): RichViewContext | undefined {
  return contexts.get(richRoot)
}

export function isUnchangedSectionExpanded(
  richRoot: Element,
  sectionId: string,
): boolean {
  return Boolean(getRichViewContext(richRoot)?.expandedUnchangedIds?.has(sectionId))
}

export function expandUnchangedSection(
  richRoot: Element,
  sectionId: string,
): void {
  const ctx = getRichViewContext(richRoot)
  if (!ctx) return
  const next = new Set(ctx.expandedUnchangedIds ?? [])
  next.add(sectionId)
  setRichViewContext(richRoot, { ...ctx, expandedUnchangedIds: next })
}

export function collapseUnchangedSection(
  richRoot: Element,
  sectionId: string,
): void {
  const ctx = getRichViewContext(richRoot)
  if (!ctx) return
  const next = new Set(ctx.expandedUnchangedIds ?? [])
  next.delete(sectionId)
  setRichViewContext(richRoot, { ...ctx, expandedUnchangedIds: next })
}

export function toggleUnchangedSection(
  richRoot: Element,
  sectionId: string,
): boolean {
  const expanded = isUnchangedSectionExpanded(richRoot, sectionId)
  if (expanded) {
    collapseUnchangedSection(richRoot, sectionId)
    return false
  }
  expandUnchangedSection(richRoot, sectionId)
  return true
}

/**
 * Map the current DOM selection inside a rich root to a source range.
 * Returns null when the selection is empty, crosses sides, or has no anchors.
 * Ranges are expanded to whole source lines (GitHub line-comment grain).
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

  let mapped: SourceRange | null = null

  if (startCell === endCell) {
    const anchor = anchorFromCell(startCell, ctx)
    if (!anchor) return null
    const startOffset = srcOffsetInCell(
      startCell,
      range.startContainer,
      range.startOffset,
    )
    const endOffset = srcOffsetInCell(
      startCell,
      range.endContainer,
      range.endOffset,
    )
    if (startOffset == null || endOffset == null) return null
    mapped = offsetsToSourceRange(anchor, startOffset, endOffset, quotedText)
  } else {
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
    const endOffset = srcOffsetInCell(
      endCell,
      range.endContainer,
      range.endOffset,
    )
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
    mapped = mergeSourceRanges(startRange, endRange)
  }

  if (!mapped) return null

  const fileText = mapped.side === 'LEFT' ? ctx.baseText : ctx.headText
  // Expand to whole source lines for the *user's* selection only.
  // Do not jump to distant commentable hunks here — that hijacks the live
  // selection (e.g. L10–12 → L90–93). GitHub line rules are enforced on create.
  return expandSourceRangeToWholeLines(mapped, fileText)
}

/**
 * Expand the live DOM selection to cover the rendered text for a source range.
 * Returns the DOM Range used, or null when it cannot be resolved.
 */
export function snapDomSelectionToSourceRange(
  selection: Selection,
  richRoot: Element,
  sourceRange: SourceRange,
): Range | null {
  const domRange = domRangeForSourceRange(richRoot, sourceRange)
  if (!domRange) return null
  try {
    selection.removeAllRanges()
    selection.addRange(domRange)
    return domRange
  } catch {
    return null
  }
}

/** Paint a persistent highlight for the active comment range (survives focus loss). */
export function applySelectionHighlight(
  richRoot: HTMLElement,
  sourceRange: SourceRange,
): void {
  clearSelectionHighlight(richRoot)
  const domRange = domRangeForSourceRange(richRoot, sourceRange)
  if (!domRange) return

  const layer = document.createElement('div')
  layer.setAttribute(HIGHLIGHT_ATTR, '')
  layer.className = 'rgm-sel-highlight-layer'
  layer.setAttribute('aria-hidden', 'true')

  const rootRect = richRoot.getBoundingClientRect()
  const rects =
    typeof domRange.getClientRects === 'function'
      ? [...domRange.getClientRects()]
      : []

  for (const rect of rects) {
    if (rect.width <= 0 && rect.height <= 0) continue
    const box = document.createElement('div')
    box.className = 'rgm-sel-highlight'
    box.style.top = `${rect.top - rootRect.top + richRoot.scrollTop}px`
    box.style.left = `${rect.left - rootRect.left + richRoot.scrollLeft}px`
    box.style.width = `${rect.width}px`
    box.style.height = `${rect.height}px`
    layer.appendChild(box)
  }

  // Fallback when layout APIs are missing (jsdom): tint overlapping cells.
  if (layer.childElementCount === 0) {
    for (const cell of cellsOverlappingRange(richRoot, sourceRange)) {
      cell.classList.add('rgm-sel-highlight-cell')
    }
  }

  richRoot.appendChild(layer)
}

export function clearSelectionHighlight(richRoot: Element): void {
  richRoot.querySelector(`[${HIGHLIGHT_ATTR}]`)?.remove()
  for (const cell of richRoot.querySelectorAll('.rgm-sel-highlight-cell')) {
    cell.classList.remove('rgm-sel-highlight-cell')
  }
}

/** Prefer the cell that owns the end line of a source range (composer mount point). */
export function findCellForSourceRange(
  richRoot: Element,
  range: SourceRange,
): HTMLElement | null {
  const overlapping = cellsOverlappingRange(richRoot, range)
  if (overlapping.length === 0) return null

  const endCell = overlapping.find((cell) => {
    const from = Number(cell.getAttribute('data-src-from'))
    const to = Number(cell.getAttribute('data-src-to'))
    return range.endLine >= from && range.endLine <= to
  })
  return endCell ?? overlapping[overlapping.length - 1]!
}

function domRangeForSourceRange(
  richRoot: Element,
  sourceRange: SourceRange,
): Range | null {
  const ctx = contexts.get(richRoot)
  if (!ctx) return null

  const cells = cellsOverlappingRange(richRoot, sourceRange)
  if (cells.length === 0) return null

  const first = cells[0]!
  const last = cells[cells.length - 1]!
  const startAnchor = anchorFromCell(first, ctx)
  const endAnchor = anchorFromCell(last, ctx)
  if (!startAnchor || !endAnchor) return null

  const startOffsets = plainOffsetsForLineSpan(
    startAnchor,
    sourceRange.startLine,
    sourceRange.endLine,
  )
  const endOffsets = plainOffsetsForLineSpan(
    endAnchor,
    sourceRange.startLine,
    sourceRange.endLine,
  )
  if (!startOffsets || !endOffsets) return null

  const startPoint = domPointAtSrcOffset(first, startOffsets.from)
  const endPoint = domPointAtSrcOffset(last, endOffsets.to)
  if (!startPoint || !endPoint) return null

  try {
    const domRange = document.createRange()
    domRange.setStart(startPoint.node, startPoint.offset)
    domRange.setEnd(endPoint.node, endPoint.offset)
    return domRange
  } catch {
    return null
  }
}

function cellsOverlappingRange(
  richRoot: Element,
  range: SourceRange,
): HTMLElement[] {
  const cells = [
    ...richRoot.querySelectorAll<HTMLElement>(
      `.rgm-rich-cell[data-side="${range.side}"]:not(.rgm-rich-cell-missing)`,
    ),
  ]
  return cells.filter((cell) => {
    const from = Number(cell.getAttribute('data-src-from'))
    const to = Number(cell.getAttribute('data-src-to'))
    if (!Number.isFinite(from) || !Number.isFinite(to)) return false
    return from <= range.endLine && to >= range.startLine
  })
}

/**
 * Resolve a plain-text offset inside a cell to a DOM text point.
 */
export function domPointAtSrcOffset(
  cell: HTMLElement,
  srcOffset: number,
): { node: Text; offset: number } | null {
  const content = cell.querySelector('.rgm-rich-content')
  if (!content) return null

  const target = Math.max(0, srcOffset)
  let seen = 0
  const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT)
  let current = walker.nextNode()
  let lastText: Text | null = null

  while (current) {
    if (isChromeText(current)) {
      current = walker.nextNode()
      continue
    }
    const text = current as Text
    lastText = text
    const len = text.textContent?.length ?? 0
    if (seen + len >= target) {
      return { node: text, offset: target - seen }
    }
    seen += len
    current = walker.nextNode()
  }

  if (lastText) {
    return { node: lastText, offset: lastText.textContent?.length ?? 0 }
  }
  return null
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
  if (!content || (!content.contains(node) && node !== content)) {
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
