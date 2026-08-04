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
  /** Empty sets mean unknown (no patch). */
  commentable?: CommentableLines
  /**
   * Unchanged section ids that are currently expanded.
   * Default empty means all unchanged sections start collapsed.
   */
  expandedUnchangedIds?: Set<string>
  /** Signed-in GitHub login for own-comment edit/delete. */
  viewerLogin?: string
}

const contexts = new WeakMap<Element, RichViewContext>()
const HIGHLIGHT_ATTR = 'data-rgm-sel-highlight'
const THREAD_HOVER_ATTR = 'data-rgm-thread-hover'
const COMMENTED_ATTR = 'data-rgm-commented-layer'

/**
 * Attach snapshot text and rows to the rich root for selection mapping.
 * @param richRoot - The rich view root element.
 * @param ctx - Context object with text, rows, and metadata.
 * @returns Nothing.
 */
export function setRichViewContext(
  richRoot: Element,
  ctx: RichViewContext,
): void {
  contexts.set(richRoot, {
    ...ctx,
    expandedUnchangedIds: ctx.expandedUnchangedIds ?? new Set(),
  })
}

/**
 * Remove the stored context for a rich root.
 * @param richRoot - The rich view root element.
 * @returns Nothing.
 */
export function clearRichViewContext(richRoot: Element): void {
  contexts.delete(richRoot)
}

/**
 * Get the stored context for a rich root.
 * @param richRoot - The rich view root element.
 * @returns The context object, or undefined if not set.
 */
export function getRichViewContext(
  richRoot: Element,
): RichViewContext | undefined {
  return contexts.get(richRoot)
}

/**
 * Determine if an unchanged section is currently expanded.
 * @param richRoot - The rich view root element.
 * @param sectionId - The unchanged section identifier.
 * @returns True when the section is expanded.
 */
export function isUnchangedSectionExpanded(
  richRoot: Element,
  sectionId: string,
): boolean {
  return Boolean(getRichViewContext(richRoot)?.expandedUnchangedIds?.has(sectionId))
}

/**
 * Mark an unchanged section as expanded in the context.
 * @param richRoot - The rich view root element.
 * @param sectionId - The unchanged section identifier.
 * @returns Nothing.
 */
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

/**
 * Mark an unchanged section as collapsed in the context.
 * @param richRoot - The rich view root element.
 * @param sectionId - The unchanged section identifier.
 * @returns Nothing.
 */
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

/**
 * Toggle an unchanged section between expanded and collapsed.
 * @param richRoot - The rich view root element.
 * @param sectionId - The unchanged section identifier.
 * @returns True if the section is now expanded, false if collapsed.
 */
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
 * @param selection - The browser Selection object.
 * @param richRoot - The rich view root element.
 * @returns A SourceRange, or null if mapping fails.
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
    // Multi-cell on the same side: span from first block start through last block end.
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
  // Expand to whole source lines for the user selection only.
  // Do not jump to distant commentable hunks here.
  return expandSourceRangeToWholeLines(mapped, fileText)
}

/**
 * Expand the live DOM selection to cover the rendered text for a source range.
 * @param selection - The browser Selection object.
 * @param richRoot - The rich view root element.
 * @param sourceRange - The target source range.
 * @returns The DOM Range used, or null when it cannot be resolved.
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

/**
 * Paint a persistent highlight for the active comment range.
 * Survives focus loss.
 * @param richRoot - The rich view root element.
 * @param sourceRange - The source range to highlight.
 * @returns Nothing.
 */
export function applySelectionHighlight(
  richRoot: HTMLElement,
  sourceRange: SourceRange,
): void {
  clearSelectionHighlight(richRoot)
  const layer = createHighlightLayer(HIGHLIGHT_ATTR, 'rgm-sel-highlight-layer')
  appendRangeBoxes(richRoot, layer, sourceRange, {
    boxClass: 'rgm-sel-highlight',
    cellClass: 'rgm-sel-highlight-cell',
  })
  richRoot.appendChild(layer)
}

/**
 * Remove the selection highlight layer and associated cell classes.
 * @param richRoot - The rich view root element.
 * @returns Nothing.
 */
export function clearSelectionHighlight(richRoot: Element): void {
  richRoot.querySelector(`[${HIGHLIGHT_ATTR}]`)?.remove()
  for (const cell of richRoot.querySelectorAll('.rgm-sel-highlight-cell')) {
    cell.classList.remove('rgm-sel-highlight-cell')
  }
}

/**
 * Highlight the text range that a hovered or focused thread card targets.
 * @param richRoot - The rich view root element.
 * @param sourceRange - The source range to highlight.
 * @returns Nothing.
 */
export function applyThreadHoverHighlight(
  richRoot: HTMLElement,
  sourceRange: SourceRange,
): void {
  clearThreadHoverHighlight(richRoot)
  const layer = createHighlightLayer(
    THREAD_HOVER_ATTR,
    'rgm-thread-hover-layer',
  )
  appendRangeBoxes(richRoot, layer, sourceRange, {
    boxClass: 'rgm-thread-hover-box',
    cellClass: 'rgm-thread-hover-cell',
  })
  richRoot.appendChild(layer)
}

/**
 * Remove the thread hover highlight layer and associated cell classes.
 * @param richRoot - The rich view root element.
 * @returns Nothing.
 */
export function clearThreadHoverHighlight(richRoot: Element): void {
  richRoot.querySelector(`[${THREAD_HOVER_ATTR}]`)?.remove()
  for (const cell of richRoot.querySelectorAll('.rgm-thread-hover-cell')) {
    cell.classList.remove('rgm-thread-hover-cell')
  }
}

/**
 * Paint persistent marks over every commented text range.
 * Reviewers can see at a glance which passages have threads.
 * Boxes carry the thread id for click-to-scroll hit-testing.
 * @param richRoot - The rich view root element.
 * @param marks - Array of thread id and source range pairs.
 * @returns Nothing.
 */
export function paintCommentedMarks(
  richRoot: HTMLElement,
  marks: { threadId: number; range: SourceRange }[],
): void {
  clearCommentedMarks(richRoot)
  if (marks.length === 0) return

  const layer = createHighlightLayer(COMMENTED_ATTR, 'rgm-commented-layer')
  for (const mark of marks) {
    appendRangeBoxes(richRoot, layer, mark.range, {
      boxClass: 'rgm-commented-box',
      cellClass: 'rgm-commented-cell',
      threadId: String(mark.threadId),
    })
  }
  richRoot.appendChild(layer)
}

/**
 * Remove the commented marks layer and associated cell classes.
 * @param richRoot - The rich view root element.
 * @returns Nothing.
 */
export function clearCommentedMarks(richRoot: Element): void {
  richRoot.querySelector(`[${COMMENTED_ATTR}]`)?.remove()
  for (const cell of richRoot.querySelectorAll('.rgm-commented-cell')) {
    cell.classList.remove('rgm-commented-cell')
    cell.removeAttribute('data-rgm-commented-thread')
  }
}

/**
 * Create a positioned highlight layer element.
 * @param attr - Data attribute to mark the layer.
 * @param className - CSS class name for the layer.
 * @returns The layer element.
 */
function createHighlightLayer(attr: string, className: string): HTMLElement {
  const layer = document.createElement('div')
  layer.setAttribute(attr, '')
  layer.className = className
  layer.setAttribute('aria-hidden', 'true')
  return layer
}

/**
 * Append positioned boxes covering a source range to a highlight layer.
 * Falls back to tinting overlapping cells when layout APIs are missing.
 * @param richRoot - The rich view root element.
 * @param layer - The highlight layer to append boxes into.
 * @param sourceRange - The source range to cover.
 * @param opts - Box class, cell class, and optional thread id.
 * @returns Nothing.
 */
function appendRangeBoxes(
  richRoot: HTMLElement,
  layer: HTMLElement,
  sourceRange: SourceRange,
  opts: { boxClass: string; cellClass: string; threadId?: string },
): void {
  const domRange = domRangeForSourceRange(richRoot, sourceRange)
  if (!domRange) return

  const rootRect = richRoot.getBoundingClientRect()
  const rects =
    typeof domRange.getClientRects === 'function'
      ? [...domRange.getClientRects()]
      : []

  let painted = 0
  for (const rect of rects) {
    if (rect.width <= 0 && rect.height <= 0) continue
    const box = document.createElement('div')
    box.className = opts.boxClass
    if (opts.threadId) {
      box.setAttribute('data-thread-id', opts.threadId)
    }
    box.style.top = `${rect.top - rootRect.top + richRoot.scrollTop}px`
    box.style.left = `${rect.left - rootRect.left + richRoot.scrollLeft}px`
    box.style.width = `${rect.width}px`
    box.style.height = `${rect.height}px`
    layer.appendChild(box)
    painted += 1
  }

  if (painted === 0) {
    for (const cell of cellsOverlappingRange(richRoot, sourceRange)) {
      cell.classList.add(opts.cellClass)
      if (opts.threadId) {
        cell.setAttribute('data-rgm-commented-thread', opts.threadId)
      }
    }
  }
}

/**
 * Find the cell that owns the end line of a source range.
 * Used as the composer mount point.
 * @param richRoot - The rich view root element.
 * @param range - The source range to locate.
 * @returns The target cell element, or null if not found.
 */
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

/**
 * Create a DOM Range that covers the given source range.
 * @param richRoot - The rich view root element.
 * @param sourceRange - The source range to resolve.
 * @returns The DOM Range, or null when it cannot be resolved.
 */
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

/**
 * Find all cells on the given side that overlap with a source range.
 * @param richRoot - The rich view root element.
 * @param range - The source range to match against.
 * @returns Array of overlapping cell elements.
 */
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
 * @param cell - The cell element to search within.
 * @param srcOffset - The zero-based plain-text offset.
 * @returns A text node and local offset, or null if not resolved.
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

/**
 * Find the nearest rich-cell ancestor for a DOM node.
 * @param node - The DOM node to start from.
 * @param richRoot - The rich view root element.
 * @returns The cell element, or null if the node is not in a valid cell.
 */
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

/**
 * Extract the review side from a cell data attribute.
 * @param cell - The cell element.
 * @returns The review side, or null if the attribute is invalid.
 */
function sideFromCell(cell: HTMLElement): ReviewSide | null {
  const side = cell.getAttribute('data-side')
  if (side === 'LEFT' || side === 'RIGHT') {
    return side
  }
  return null
}

/**
 * Build a block source anchor from a cell element and view context.
 * @param cell - The cell element.
 * @param ctx - The rich view context.
 * @returns The anchor object, or null if the cell lacks required data.
 */
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

/**
 * Find a block view by its composite id (rowId::side).
 * @param blockId - The composite block identifier.
 * @param rows - All row models.
 * @returns The block view, or null if not found.
 */
function blockFromId(blockId: string, rows: RowModel[]): BlockView | null {
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

/**
 * Extract the plain text content of a block view node.
 * @param block - The block view.
 * @returns The plain text string.
 */
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
 * Resolve a DOM point to an offset in the block plain/source text.
 * Prefers data-src-offset segment maps. Falls back to a text walk
 * that skips chrome (data-rgm-chrome).
 * @param cell - The cell element.
 * @param node - The DOM node the selection starts or ends in.
 * @param offset - The offset within that DOM node.
 * @returns The source-text offset, or null if not resolvable.
 */
export function srcOffsetInCell(
  cell: HTMLElement,
  node: Node,
  offset: number,
): number | null {
  const content = cell.querySelector('.rgm-rich-content')
  if (!content || (!content.contains(node) && node !== content)) {
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

/**
 * Walk up the DOM to find the nearest ancestor with data-src-offset.
 * @param node - The starting DOM node.
 * @param content - The content boundary element.
 * @returns The host element, or null if not found.
 */
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

/**
 * Count the text offset of a target node within a host element.
 * @param host - The container element.
 * @param target - The target DOM node.
 * @param targetOffset - The offset within the target node.
 * @returns The cumulative text offset.
 */
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

/**
 * Walk text nodes under a root to compute an offset to the target node.
 * @param root - The root element to walk.
 * @param target - The target DOM node.
 * @param targetOffset - The offset within the target node.
 * @returns The cumulative text offset, or null if the target is not found.
 */
function walkTextOffset(
  root: Element,
  target: Node,
  targetOffset: number,
): number | null {
  if (target === root) {
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

/**
 * Count the selectable text length of a node, skipping chrome nodes.
 * @param node - The DOM node to measure.
 * @returns The text length.
 */
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

/**
 * Determine if a text node lives inside a chrome element.
 * @param node - The DOM node to test.
 * @returns True when the node is inside data-rgm-chrome.
 */
function isChromeText(node: Node): boolean {
  const el = node.parentElement
  return Boolean(el?.closest('[data-rgm-chrome]'))
}

/**
 * Normalize selected text for comparison (collapse whitespace).
 * @param text - Raw selected text.
 * @returns Normalized string.
 */
function normalizeQuoted(text: string): string {
  return text.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
}
