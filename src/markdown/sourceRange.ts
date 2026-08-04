/** GitHub review-comment side: Before = LEFT, After = RIGHT. */
export type ReviewSide = 'LEFT' | 'RIGHT'

/**
 * Source span for a rich-view selection.
 * Lines and columns are 1-based; endCol is exclusive for empty slices
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
  /** Block plain text (ProseMirror textContent / front matter value). */
  plainText: string
  /** Inclusive source lines for [srcFrom, srcTo]. */
  sourceLines: string[]
}

/**
 * Slice 1-based inclusive line numbers from a full file string.
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
  // File text often ends with a trailing newline → final empty split entry.
  // Source line N is all[N - 1]; do not trim the trailing empty unless
  // it is past srcTo.
  return all.slice(srcFrom - 1, srcTo)
}

/**
 * Map a character offset inside block plain text to a source line/col.
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

  // Wrapped / multi-line Markdown with a single plain blob: pin endpoints
  // to the block bounds; mid-offsets stay on the first line as a best effort.
  if (offset <= 0) {
    return { line: srcFrom, col: 1 }
  }
  if (offset >= plainText.length) {
    const last = sourceLines[sourceLines.length - 1] ?? ''
    return { line: srcTo, col: last.length + 1 }
  }
  return { line: srcFrom, col: offset + 1 }
}

/**
 * Build a SourceRange from plain-text offsets inside one block.
 * Offsets may be in either order (selection direction does not matter).
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
 * Merge two same-side ranges (e.g. selection across adjacent blocks).
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

function joinQuoted(left: string, right: string): string {
  if (!left) return right
  if (!right) return left
  if (left.endsWith(right) || left.includes(right)) return left
  if (right.startsWith(left)) return right
  return `${left}${right}`
}

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

function isFencedCode(sourceLines: string[]): boolean {
  if (sourceLines.length < 2) return false
  const first = sourceLines[0] ?? ''
  const last = sourceLines[sourceLines.length - 1] ?? ''
  return /^`{3,}/.test(first) && /^`{3,}\s*$/.test(last)
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}
