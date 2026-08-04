/** GitHub review-comment side. `'LEFT'` = before, `'RIGHT'` = after. */
export type ReviewSide = 'LEFT' | 'RIGHT'

/**
 * Source span for a rich-view selection.
 * Lines and columns are 1-based. `endCol` is exclusive for empty slices
 * at end-of-line (col = lineLength + 1).
 */
export type SourceRange = {
  side: ReviewSide
  startLine: number
  startCol: number
  endLine: number
  endCol: number
  quotedText: string
}

export type BlockSourceAnchor = {
  side: ReviewSide
  srcFrom: number
  srcTo: number
  /** Block plain text (ProseMirror `textContent` or front-matter value). */
  plainText: string
  /** Inclusive source lines for the range [`srcFrom`, `srcTo`]. */
  sourceLines: string[]
}

/**
 * Extract lines from a full file string by 1-based inclusive line numbers.
 * @param fileText - The complete file content.
 * @param srcFrom - First line (1-based, inclusive).
 * @param srcTo - Last line (1-based, inclusive).
 * @returns Array of source lines in the given range.
 */
export function linesForRange(
  fileText: string,
  srcFrom: number,
  srcTo: number,
): string[] {
  if (srcFrom < 1 || srcTo < srcFrom) {
    return []
  }
  const all = fileText.split('\n')
  // File text often ends with a trailing newline, which creates a final empty
  // split entry. Source line N is `all[N - 1]`. Do not trim the trailing
  // empty entry unless it is past `srcTo`.
  return all.slice(srcFrom - 1, srcTo)
}

/**
 * Map a character offset inside block plain text to a 1-based source line and column.
 * @param args - Plain text, source range, source lines, and the offset to map.
 * @returns An object with `line` and `col` (both 1-based).
 */
export function plainOffsetToPos(args: {
  plainText: string
  srcFrom: number
  srcTo: number
  sourceLines: string[]
  offset: number
}): { line: number; col: number } {
  const { plainText, srcFrom, srcTo, sourceLines } = args
  const offset = clamp(args.offset, 0, plainText.length)

  if (sourceLines.length === 0 || srcFrom < 1) {
    return { line: Math.max(srcFrom, 1), col: offset + 1 }
  }

  if (plainText.includes('\n')) {
    return offsetInMultilinePlain({
      plainText,
      srcFrom,
      srcTo,
      sourceLines,
      offset,
    })
  }

  if (srcFrom === srcTo) {
    const sourceLine = sourceLines[0] ?? ''
    const idx = sourceLine.indexOf(plainText)
    if (plainText.length > 0 && idx >= 0) {
      return { line: srcFrom, col: idx + offset + 1 }
    }
    return {
      line: srcFrom,
      col: clamp(offset + 1, 1, sourceLine.length + 1),
    }
  }

  // Soft-wrapped or multi-line Markdown rendered as one plain blob (no `\n`).
  return offsetInWrappedPlain({
    plainText,
    srcFrom,
    srcTo,
    sourceLines,
    offset,
  })
}

/**
 * Build a `SourceRange` from plain-text offsets inside one block.
 * Offsets can be in either order because selection direction does not matter.
 * @param anchor - Block-level source anchor.
 * @param startOffset - First offset in the block's plain text.
 * @param endOffset - Second offset in the block's plain text.
 * @param quotedText - The selected text to attach to the range.
 * @returns The computed `SourceRange`.
 */
export function offsetsToSourceRange(
  anchor: BlockSourceAnchor,
  startOffset: number,
  endOffset: number,
  quotedText: string,
): SourceRange {
  const from = Math.min(startOffset, endOffset)
  const to = Math.max(startOffset, endOffset)
  const start = plainOffsetToPos({
    plainText: anchor.plainText,
    srcFrom: anchor.srcFrom,
    srcTo: anchor.srcTo,
    sourceLines: anchor.sourceLines,
    offset: from,
  })
  const end = plainOffsetToPos({
    plainText: anchor.plainText,
    srcFrom: anchor.srcFrom,
    srcTo: anchor.srcTo,
    sourceLines: anchor.sourceLines,
    offset: to,
  })

  return {
    side: anchor.side,
    startLine: start.line,
    startCol: start.col,
    endLine: end.line,
    endCol: end.col,
    quotedText,
  }
}

/**
 * Expand a range to whole source lines (col 1 to end of last line).
 * This matches how GitHub review comments attach to line spans.
 * @param range - The original source range.
 * @param fileText - Full file content for line-length lookup.
 * @returns A new `SourceRange` that covers complete lines.
 */
export function expandSourceRangeToWholeLines(
  range: SourceRange,
  fileText: string,
): SourceRange {
  const startLine = Math.min(range.startLine, range.endLine)
  const endLine = Math.max(range.startLine, range.endLine)
  const lines = fileText.split('\n')
  const last = lines[endLine - 1] ?? ''
  const quotedText = lines.slice(startLine - 1, endLine).join('\n')
  return {
    side: range.side,
    startLine,
    startCol: 1,
    endLine,
    endCol: last.length + 1,
    quotedText,
  }
}

/**
 * Map a 1-based source line and column to an offset in the block's plain text.
 * When the exact column falls outside the plain text (for example, a Markdown
 * heading marker that is not rendered), the closest valid offset is returned.
 * @param anchor - Block-level source anchor.
 * @param line - 1-based source line.
 * @param col - 1-based source column.
 * @returns The best-matching character offset in `anchor.plainText`.
 */
export function sourcePosToPlainOffset(
  anchor: BlockSourceAnchor,
  line: number,
  col: number,
): number {
  const targetCol = Math.max(1, col)
  let best = 0
  let bestScore = Number.POSITIVE_INFINITY

  for (let offset = 0; offset <= anchor.plainText.length; offset += 1) {
    const pos = plainOffsetToPos({
      plainText: anchor.plainText,
      srcFrom: anchor.srcFrom,
      srcTo: anchor.srcTo,
      sourceLines: anchor.sourceLines,
      offset,
    })
    const score =
      Math.abs(pos.line - line) * 10_000 + Math.abs(pos.col - targetCol)
    if (score < bestScore) {
      bestScore = score
      best = offset
    }
    if (score === 0) break
  }

  return best
}

/**
 * Get plain-text offsets inside a block that cover [`startLine`, `endLine`].
 * @param anchor - Block-level source anchor.
 * @param startLine - First line of the span (1-based).
 * @param endLine - Last line of the span (1-based).
 * @returns `{ from, to }` offsets, or `null` when the block does not overlap.
 */
export function plainOffsetsForLineSpan(
  anchor: BlockSourceAnchor,
  startLine: number,
  endLine: number,
): { from: number; to: number } | null {
  const fromLine = Math.max(startLine, anchor.srcFrom)
  const toLine = Math.min(endLine, anchor.srcTo)
  if (fromLine > toLine) {
    return null
  }

  if (fromLine === anchor.srcFrom && toLine === anchor.srcTo) {
    return { from: 0, to: anchor.plainText.length }
  }

  const last = anchor.sourceLines[toLine - anchor.srcFrom] ?? ''
  const from = sourcePosToPlainOffset(anchor, fromLine, 1)
  const to = sourcePosToPlainOffset(anchor, toLine, last.length + 1)
  if (from === to && anchor.plainText.length > 0) {
    return { from: 0, to: anchor.plainText.length }
  }
  return { from: Math.min(from, to), to: Math.max(from, to) }
}

/**
 * Merge two same-side source ranges (for example, a selection across adjacent blocks).
 * @param a - First source range.
 * @param b - Second source range.
 * @returns The merged range, or `null` when the sides differ.
 */
export function mergeSourceRanges(
  a: SourceRange,
  b: SourceRange,
): SourceRange | null {
  if (a.side !== b.side) {
    return null
  }
  const aFirst =
    a.startLine < b.startLine ||
    (a.startLine === b.startLine && a.startCol <= b.startCol)
  const start = aFirst ? a : b
  const end = aFirst ? b : a
  return {
    side: a.side,
    startLine: start.startLine,
    startCol: start.startCol,
    endLine: end.endLine,
    endCol: end.endCol,
    quotedText: aFirst
      ? joinQuoted(a.quotedText, b.quotedText)
      : joinQuoted(b.quotedText, a.quotedText),
  }
}

/**
 * Join two quoted-text strings, avoiding duplication when one contains the other.
 * @param left - Quoted text from the earlier range.
 * @param right - Quoted text from the later range.
 * @returns The combined quoted text.
 */
function joinQuoted(left: string, right: string): string {
  if (!left) return right
  if (!right) return left
  if (left.endsWith(right) || left.includes(right)) return left
  if (right.startsWith(left)) return right
  return `${left}${right}`
}

/**
 * Map an offset in multi-line plain text (contains `\n`) to a source line and column.
 * @param args - Plain text, source range, source lines, and the target offset.
 * @returns An object with `line` and `col` (both 1-based).
 */
function offsetInMultilinePlain(args: {
  plainText: string
  srcFrom: number
  srcTo: number
  sourceLines: string[]
  offset: number
}): { line: number; col: number } {
  const { plainText, srcFrom, srcTo, sourceLines, offset } = args
  const parts = plainText.split('\n')
  const fence = isFencedCode(sourceLines)
  const contentStart = fence ? srcFrom + 1 : srcFrom

  let remaining = offset
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!
    const line = clamp(contentStart + i, srcFrom, srcTo)
    if (remaining <= part.length) {
      return { line, col: remaining + 1 }
    }
    remaining -= part.length + 1
  }

  const last = sourceLines[sourceLines.length - 1] ?? ''
  return { line: srcTo, col: last.length + 1 }
}

/**
 * Map an offset in rendered plain text onto soft-wrapped source lines.
 * Each source line's visible content is located in order inside `plainText`.
 * Softbreaks can become a space or disappear in ProseMirror `textContent`.
 * @param args - Plain text, source range, source lines, and the target offset.
 * @returns An object with `line` and `col` (both 1-based).
 */
function offsetInWrappedPlain(args: {
  plainText: string
  srcFrom: number
  srcTo: number
  sourceLines: string[]
  offset: number
}): { line: number; col: number } {
  const { plainText, srcFrom, srcTo, sourceLines, offset } = args
  const segments = locateWrappedSegments(plainText, sourceLines, srcFrom)

  if (segments.length === 0) {
    if (offset <= 0) return { line: srcFrom, col: 1 }
    const last = sourceLines[sourceLines.length - 1] ?? ''
    return { line: srcTo, col: last.length + 1 }
  }

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!
    const isLast = i === segments.length - 1
    if (offset < seg.plainTo || (isLast && offset >= seg.plainTo)) {
      const local = Math.max(0, Math.min(offset, seg.plainTo) - seg.plainFrom)
      return { line: seg.line, col: seg.colBase + local }
    }
  }

  const lastSeg = segments[segments.length - 1]!
  return {
    line: lastSeg.line,
    col: lastSeg.colBase + (lastSeg.plainTo - lastSeg.plainFrom),
  }
}

type WrappedSegment = {
  line: number
  plainFrom: number
  plainTo: number
  /** 1-based source column that corresponds to `plainFrom`. */
  colBase: number
}

/**
 * Locate each source line's visible content inside the plain text string.
 * @param plainText - Rendered plain text of the block.
 * @param sourceLines - Raw source lines for the block.
 * @param srcFrom - 1-based line number of the first source line.
 * @returns Array of segments that map plain-text ranges to source lines.
 */
function locateWrappedSegments(
  plainText: string,
  sourceLines: string[],
  srcFrom: number,
): WrappedSegment[] {
  const segments: WrappedSegment[] = []
  let cursor = 0

  for (let i = 0; i < sourceLines.length; i++) {
    const raw = sourceLines[i] ?? ''
    const lineNum = srcFrom + i
    if (raw.length === 0) {
      continue
    }

    const match = matchSourceLineInPlain(plainText, cursor, raw)
    if (!match) {
      continue
    }

    segments.push({
      line: lineNum,
      plainFrom: match.plainFrom,
      plainTo: match.plainTo,
      colBase: match.colBase,
    })
    cursor = match.plainTo
  }

  return segments
}

/**
 * Find the next source line's content inside plain text at or after `from`.
 * This handles Markdown markers that are not present in rendered plain text
 * and optional whitespace inserted for softbreaks.
 * @param plainText - Full rendered plain text of the block.
 * @param from - Start index to search from.
 * @param sourceLine - The raw source line to locate.
 * @returns Match positions and column base, or `null` when not found.
 */
function matchSourceLineInPlain(
  plainText: string,
  from: number,
  sourceLine: string,
): { plainFrom: number; plainTo: number; colBase: number } | null {
  const trimmedStart = sourceLine.match(/^\s*/)?.[0]?.length ?? 0
  const body = sourceLine.slice(trimmedStart)
  if (body.length === 0) {
    return null
  }

  // Skip softbreak whitespace in the plain stream.
  let start = from
  while (start < plainText.length && /\s/.test(plainText[start]!)) {
    start += 1
  }

  // Exact body match (paragraph or continuation lines).
  if (plainText.startsWith(body, start)) {
    return {
      plainFrom: start,
      plainTo: start + body.length,
      colBase: trimmedStart + 1,
    }
  }

  // Heading, quote, or list marker not present in plain text.
  const stripped = stripMarkdownLinePrefix(body)
  if (stripped.length > 0 && stripped !== body) {
    const markerLen = body.length - stripped.length
    const gap = plainText.indexOf(stripped, start)
    if (gap >= 0 && gap - start <= 2) {
      return {
        plainFrom: gap,
        plainTo: gap + stripped.length,
        colBase: trimmedStart + markerLen + 1,
      }
    }
  }

  // Fuzzy match: walk source body against plain text, allowing extra whitespace.
  let si = 0
  let pi = start
  const plainFrom = start
  while (si < body.length && pi < plainText.length) {
    const sc = body[si]!
    const pc = plainText[pi]!
    if (sc === pc) {
      si += 1
      pi += 1
      continue
    }
    if (/\s/.test(pc)) {
      pi += 1
      continue
    }
    // Unmatched Markdown marker in source (for example, a leftover `#`).
    if (/[#>*`\-\d.]/.test(sc) && sc !== pc) {
      si += 1
      continue
    }
    break
  }

  if (si > 0 && pi > plainFrom) {
    return { plainFrom, plainTo: pi, colBase: trimmedStart + 1 }
  }

  return null
}

/**
 * Remove leading Markdown markers (headings, blockquotes, list bullets, task checkboxes).
 * @param line - A single source line.
 * @returns The line with leading Markdown syntax stripped.
 */
function stripMarkdownLinePrefix(line: string): string {
  return line
    .replace(/^#{1,6}\s+/, '')
    .replace(/^>\s?/, '')
    .replace(/^([*+-]|\d+\.)\s+/, '')
    .replace(/^\[\s?[xX ]\]\s+/, '')
}

/**
 * Determine whether the source lines represent a fenced code block.
 * @param sourceLines - Raw source lines for the block.
 * @returns `true` when the first and last lines are backtick fences.
 */
function isFencedCode(sourceLines: string[]): boolean {
  if (sourceLines.length < 2) return false
  const first = sourceLines[0] ?? ''
  const last = sourceLines[sourceLines.length - 1] ?? ''
  return /^`{3,}/.test(first) && /^`{3,}\s*$/.test(last)
}

/**
 * Clamp a number to the [`min`, `max`] range.
 * @param n - The value to clamp.
 * @param min - Lower bound.
 * @param max - Upper bound.
 * @returns The clamped value.
 */
function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}
