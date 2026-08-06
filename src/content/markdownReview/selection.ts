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

export type CommentedMark = { threadId: number; range: SourceRange }

/**
 * What each overlay layer currently shows, so a layer can be painted again
 * after the rich view reflows. Box positions are measured from layout, so
 * anything that moves the text (a reply editor opening, a card collapsing,
 * the window resizing) leaves the old boxes behind.
 */
type OverlayState = {
  selection?: SourceRange
  hover?: SourceRange
  commented?: CommentedMark[]
}

const overlays = new WeakMap<Element, OverlayState>()

/**
 * Get the mutable overlay state for a rich root, creating it on first use.
 * @param richRoot - The rich view root element.
 * @returns The overlay state record.
 */
function overlayState(richRoot: Element): OverlayState {
  let state = overlays.get(richRoot)
  if (!state) {
    state = {}
    overlays.set(richRoot, state)
  }
  return state
}

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

  const start = anchorForPoint(
    startCell,
    range.startContainer,
    range.startOffset,
    ctx,
  )
  const end = anchorForPoint(endCell, range.endContainer, range.endOffset, ctx)
  if (!start || !end) return null

  let mapped: SourceRange | null = null

  if (start.host === end.host) {
    const startOffset = start.offsetAt(range.startContainer, range.startOffset)
    const endOffset = start.offsetAt(range.endContainer, range.endOffset)
    if (startOffset == null || endOffset == null) return null
    mapped = offsetsToSourceRange(
      start.anchor,
      startOffset,
      endOffset,
      quotedText,
    )
  } else {
    // Two anchors on the same side (adjacent blocks, or two rows of one table):
    // span from the first anchor's start through the last anchor's end.
    const startOffset = start.offsetAt(range.startContainer, range.startOffset)
    const endOffset = end.offsetAt(range.endContainer, range.endOffset)
    if (startOffset == null || endOffset == null) return null

    const startRange = offsetsToSourceRange(
      start.anchor,
      startOffset,
      start.anchor.plainText.length,
      quotedText,
    )
    const endRange = offsetsToSourceRange(end.anchor, 0, endOffset, quotedText)
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
  overlayState(richRoot).selection = sourceRange
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
  delete overlayState(richRoot).selection
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
  overlayState(richRoot).hover = sourceRange
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
  delete overlayState(richRoot).hover
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
  marks: CommentedMark[],
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
  overlayState(richRoot).commented = marks
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
  delete overlayState(richRoot).commented
}

/**
 * Paint every active overlay layer again against the current layout.
 * @param richRoot - The rich view root element.
 * @returns Nothing.
 */
export function repaintOverlays(richRoot: HTMLElement): void {
  const state = overlays.get(richRoot)
  if (!state) return
  // Each paint clears its own state first, so read it all up front.
  const { commented, selection, hover } = state
  if (commented) paintCommentedMarks(richRoot, commented)
  if (selection) applySelectionHighlight(richRoot, selection)
  if (hover) applyThreadHoverHighlight(richRoot, hover)
}

/**
 * Keep overlay layers aligned with the text as the rich view reflows.
 * Opening a reply editor, collapsing a card, or resizing the window moves
 * the text out from under boxes that were positioned when they were painted.
 * @param richRoot - The rich view root element.
 * @returns A cleanup function that stops observing.
 */
export function bindOverlayRepaint(richRoot: HTMLElement): () => void {
  if (typeof ResizeObserver !== 'function') return () => {}

  let frame = 0
  const observer = new ResizeObserver(() => {
    if (frame) return
    frame = requestAnimationFrame(() => {
      frame = 0
      repaintOverlays(richRoot)
    })
  })
  // The layers are absolutely positioned, so repainting cannot resize the
  // root and retrigger the observer.
  observer.observe(richRoot)

  return () => {
    if (frame) cancelAnimationFrame(frame)
    observer.disconnect()
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
  const rects = sourceTextRects(domRange)

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
 * Collect the client rects a range covers, limited to rendered source text.
 * A range spanning several blocks also spans the gutters and thread cards
 * that sit between them, so the raw range rects would paint over that UI.
 * @param domRange - The DOM range covering the source text.
 * @returns Rects to paint, in document order.
 */
function sourceTextRects(domRange: Range): DOMRect[] {
  if (typeof domRange.getClientRects !== 'function') return []
  const rects: DOMRect[] = []
  for (const part of sourceTextSubRanges(domRange)) {
    if (typeof part.getClientRects !== 'function') continue
    rects.push(...part.getClientRects())
  }
  return rects
}

/**
 * Split a range into the pieces that fall inside rendered source text.
 * Splits per block, and per sub-anchor within a block, so thread cards mounted
 * between table rows are stepped over rather than painted on.
 * @param domRange - The DOM range covering the source text.
 * @returns One clamped range per overlapping text region.
 */
function sourceTextSubRanges(domRange: Range): Range[] {
  const container = domRange.commonAncestorContainer
  const scope =
    container instanceof Element ? container : container.parentElement
  if (!scope || typeof domRange.intersectsNode !== 'function') {
    return [domRange]
  }

  const inner = scope.closest('.rgm-rich-content')
  const contents = inner ? [inner] : [...scope.querySelectorAll('.rgm-rich-content')]

  const parts: Range[] = []
  for (const content of contents) {
    if (content !== scope && !domRange.intersectsNode(content)) continue
    for (const target of paintTargetsIn(content, domRange)) {
      const part = clampRangeTo(target, domRange)
      if (part) parts.push(part)
    }
  }
  // A range that resolves to nothing (no content element in scope) still paints
  // as one piece, matching the pre-split behaviour.
  return parts.length > 0 ? parts : [domRange]
}

/**
 * List the elements a range should paint inside one block.
 * Prefers the sub-anchors the range touches, so only real rows or items are
 * covered. Falls back to the whole block when it has none.
 * @param content - The block content element.
 * @param domRange - The DOM range covering the source text.
 * @returns Elements to paint, in document order.
 */
function paintTargetsIn(content: Element, domRange: Range): Element[] {
  const subs = [
    ...content.querySelectorAll<HTMLElement>(SUB_ANCHOR_SELECTOR),
  ].filter((el) => domRange.intersectsNode(el))
  // Nested items (a list inside a list item) would paint twice over.
  const outermost = subs.filter(
    (el) => !subs.some((other) => other !== el && other.contains(el)),
  )
  return outermost.length > 0 ? outermost : [content]
}

/**
 * Clamp a range to the contents of an element.
 * @param target - The element to clamp to.
 * @param domRange - The range providing the outer bounds.
 * @returns The clamped range, or null when the overlap is empty.
 */
function clampRangeTo(target: Element, domRange: Range): Range | null {
  const part = document.createRange()
  part.selectNodeContents(target)
  if (part.compareBoundaryPoints(Range.START_TO_START, domRange) < 0) {
    part.setStart(domRange.startContainer, domRange.startOffset)
  }
  if (part.compareBoundaryPoints(Range.END_TO_END, domRange) > 0) {
    part.setEnd(domRange.endContainer, domRange.endOffset)
  }
  return part.collapsed ? null : part
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
 * Find the last sub-anchor (table row, list item) a source range covers.
 * Comment UI mounts after this element so it lands with the text it targets
 * instead of below the whole block.
 * @param cell - The cell element to search within.
 * @param range - The source range to resolve.
 * @returns The sub-anchor element, or null when the block has none.
 */
export function findSubAnchorForSourceRange(
  cell: HTMLElement,
  range: SourceRange,
): HTMLElement | null {
  const overlapping = subAnchorsIn(cell).filter((el) =>
    elementOverlapsRange(el, range),
  )
  return overlapping[overlapping.length - 1] ?? null
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

  const start = rangeHostInCell(cells[0]!, sourceRange, ctx, 'first')
  const end = rangeHostInCell(cells[cells.length - 1]!, sourceRange, ctx, 'last')
  if (!start || !end) return null

  const startOffsets = plainOffsetsForLineSpan(
    start.anchor,
    sourceRange.startLine,
    sourceRange.endLine,
  )
  const endOffsets = plainOffsetsForLineSpan(
    end.anchor,
    sourceRange.startLine,
    sourceRange.endLine,
  )
  if (!startOffsets || !endOffsets) return null

  const startPoint = domPointAtSrcOffset(start.host, startOffsets.from)
  const endPoint = domPointAtSrcOffset(end.host, endOffsets.to)
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
 * Pick the narrowest element in a cell that a source range should resolve to.
 * Prefers the first (or last) overlapping sub-anchor so highlights cover only
 * the table rows or list items the range names, not the whole block.
 * @param cell - The cell element.
 * @param range - The source range to resolve.
 * @param ctx - The rich view context.
 * @param which - Take the first or the last overlapping sub-anchor.
 * @returns The host element and its anchor, or null when the cell lacks data.
 */
function rangeHostInCell(
  cell: HTMLElement,
  range: SourceRange,
  ctx: RichViewContext,
  which: 'first' | 'last',
): { host: HTMLElement; anchor: BlockSourceAnchor } | null {
  const side = sideFromCell(cell)
  if (side) {
    const overlapping = subAnchorsIn(cell).filter((el) =>
      elementOverlapsRange(el, range),
    )
    const pick =
      which === 'first' ? overlapping[0] : overlapping[overlapping.length - 1]
    const subAnchor = pick ? anchorFromElement(pick, side, ctx) : null
    if (pick && subAnchor) {
      return { host: pick, anchor: subAnchor }
    }
  }

  const anchor = anchorFromCell(cell, ctx)
  return anchor ? { host: cell, anchor } : null
}

/**
 * Determine whether a sub-anchor's line span overlaps a source range.
 * @param el - The sub-anchor element.
 * @param range - The source range to test.
 * @returns True when the spans intersect.
 */
function elementOverlapsRange(el: HTMLElement, range: SourceRange): boolean {
  const from = Number(el.getAttribute('data-src-from'))
  const to = Number(el.getAttribute('data-src-to'))
  if (!Number.isFinite(from) || !Number.isFinite(to)) return false
  return from <= range.endLine && to >= range.startLine
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
 * Resolve a plain-text offset inside a cell or sub-anchor to a DOM text point.
 * @param host - The cell or sub-anchor element to search within.
 * @param srcOffset - The zero-based plain-text offset.
 * @returns A text node and local offset, or null if not resolved.
 */
export function domPointAtSrcOffset(
  host: HTMLElement,
  srcOffset: number,
): { node: Text; offset: number } | null {
  // A sub-anchor (table row, list item) sits inside the content wrapper and
  // is already the narrowest scope, so it stands in for itself.
  const content = host.querySelector('.rgm-rich-content') ?? host
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
 * Elements inside a block that carry their own exact source line range.
 * Table rows and list items are one source line (or a known span) each, so a
 * selection inside one can target that line instead of the whole block.
 */
const SUB_ANCHOR_SELECTOR = '[data-src-from][data-src-to]'

/**
 * A resolved selection endpoint: the element whose source range it maps to,
 * plus how to turn a DOM point into an offset in that element's plain text.
 */
type SelectionAnchor = {
  /** Identity for comparing two endpoints. A cell or a sub-anchor element. */
  host: Element
  anchor: BlockSourceAnchor
  offsetAt: (node: Node, offset: number) => number | null
}

/**
 * List the sub-anchor elements inside a cell, in document order.
 * @param cell - The cell element.
 * @returns Sub-anchor elements, empty when the block has none.
 */
function subAnchorsIn(cell: HTMLElement): HTMLElement[] {
  const content = cell.querySelector('.rgm-rich-content')
  if (!content) return []
  return [...content.querySelectorAll<HTMLElement>(SUB_ANCHOR_SELECTOR)]
}

/**
 * Pick the sub-anchor a DOM point belongs to.
 * A point outside every sub-anchor (a boundary landing on the table or list
 * element itself) snaps to the nearest one in document order.
 * @param subs - Sub-anchor elements for the cell, in document order.
 * @param node - The DOM node the selection starts or ends in.
 * @param offset - The offset within that DOM node.
 * @returns The owning sub-anchor, or null when there are none.
 */
function subAnchorForPoint(
  subs: HTMLElement[],
  node: Node,
  offset: number,
): HTMLElement | null {
  if (subs.length === 0) return null

  const point =
    node instanceof Element
      ? (node.childNodes[offset] ?? node.lastChild ?? node)
      : node

  for (const sub of subs) {
    if (sub === point || sub.contains(point)) return sub
    if (nodePrecedesElement(point, sub)) return sub
  }
  return subs[subs.length - 1]!
}

/**
 * Determine whether a node sits before an element in document order.
 * @param node - The node to test.
 * @param el - The reference element.
 * @returns True when `node` precedes `el`.
 */
function nodePrecedesElement(node: Node, el: Element): boolean {
  if (typeof el.compareDocumentPosition !== 'function') return false
  const pos = el.compareDocumentPosition(node)
  return Boolean(pos & Node.DOCUMENT_POSITION_PRECEDING)
}

/**
 * Resolve a selection endpoint to the narrowest source anchor available.
 * Prefers the sub-anchor (table row, list item) that owns the point, and falls
 * back to the whole block when the block has none.
 * @param cell - The cell element the point is in.
 * @param node - The DOM node the selection starts or ends in.
 * @param offset - The offset within that DOM node.
 * @param ctx - The rich view context.
 * @returns The resolved anchor, or null when the cell lacks source data.
 */
function anchorForPoint(
  cell: HTMLElement,
  node: Node,
  offset: number,
  ctx: RichViewContext,
): SelectionAnchor | null {
  const side = sideFromCell(cell)
  const sub = side ? subAnchorForPoint(subAnchorsIn(cell), node, offset) : null
  const subAnchor = sub && side ? anchorFromElement(sub, side, ctx) : null

  if (sub && subAnchor) {
    const length = subAnchor.plainText.length
    return {
      host: sub,
      anchor: subAnchor,
      // A snapped point lives outside the sub-anchor, so clamp to whichever
      // end of it the point sits on.
      offsetAt: (n, o) =>
        walkTextOffset(sub, n, o) ?? (nodePrecedesElement(n, sub) ? 0 : length),
    }
  }

  const anchor = anchorFromCell(cell, ctx)
  if (!anchor) return null
  return {
    host: cell,
    anchor,
    offsetAt: (n, o) => srcOffsetInCell(cell, n, o),
  }
}

/**
 * Build a source anchor from an element that carries its own line range.
 * @param el - A sub-anchor element (table row or list item).
 * @param side - The review side the element belongs to.
 * @param ctx - The rich view context.
 * @returns The anchor object, or null when the line range is unusable.
 */
function anchorFromElement(
  el: HTMLElement,
  side: ReviewSide,
  ctx: RichViewContext,
): BlockSourceAnchor | null {
  const srcFrom = Number(el.getAttribute('data-src-from'))
  const srcTo = Number(el.getAttribute('data-src-to'))
  if (!Number.isFinite(srcFrom) || !Number.isFinite(srcTo)) {
    return null
  }

  const fileText = side === 'LEFT' ? ctx.baseText : ctx.headText
  return {
    side,
    srcFrom,
    srcTo,
    plainText: plainTextIn(el),
    sourceLines: linesForRange(fileText, srcFrom, srcTo),
  }
}

/**
 * Collect the selectable text under an element, skipping chrome nodes.
 * @param root - The element to read.
 * @returns The concatenated text.
 */
function plainTextIn(root: Element): string {
  let text = ''
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let current = walker.nextNode()
  while (current) {
    if (!isChromeText(current)) {
      text += current.textContent ?? ''
    }
    current = walker.nextNode()
  }
  return text
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
