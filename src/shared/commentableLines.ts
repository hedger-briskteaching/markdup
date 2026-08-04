import type { ReviewSide } from '../markdown/sourceRange'

export type CommentableLines = {
  left: Set<number>
  right: Set<number>
}

/** Serializable form for extension messages. */
export type CommentableLinesDto = {
  left: number[]
  right: number[]
}

export function commentableToDto(lines: CommentableLines): CommentableLinesDto {
  return {
    left: [...lines.left].sort((a, b) => a - b),
    right: [...lines.right].sort((a, b) => a - b),
  }
}

export function commentableFromDto(dto: CommentableLinesDto): CommentableLines {
  return {
    left: new Set(dto.left),
    right: new Set(dto.right),
  }
}

/**
 * Parse a unified diff patch into file line numbers GitHub will accept
 * for LEFT / RIGHT review comments (context + deleted / added).
 */
export function parseCommentableLines(patch: string): CommentableLines {
  const left = new Set<number>()
  const right = new Set<number>()
  let leftLine = 0
  let rightLine = 0

  for (const raw of patch.split('\n')) {
    const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw)
    if (hunk) {
      leftLine = Number(hunk[1])
      rightLine = Number(hunk[2])
      continue
    }
    if (raw.startsWith('\\')) {
      continue
    }
    if (raw.startsWith('+')) {
      right.add(rightLine)
      rightLine += 1
      continue
    }
    if (raw.startsWith('-')) {
      left.add(leftLine)
      leftLine += 1
      continue
    }
    if (raw.startsWith(' ') || raw === '') {
      left.add(leftLine)
      right.add(rightLine)
      leftLine += 1
      rightLine += 1
    }
  }

  return { left, right }
}

/**
 * Keep only a contiguous span of [start, end] that sits on commentable diff lines.
 * GitHub rejects multi-line comments whose interior lines are outside the PR diff.
 * Returns null when none of the selected lines are in the diff.
 * Empty commentable sets mean "unknown" (no patch) — pass the range through.
 */
export function clampRangeToDiff(
  side: ReviewSide,
  startLine: number,
  endLine: number,
  commentable: CommentableLines,
): { start: number; end: number } | null {
  const from = Math.min(startLine, endLine)
  const to = Math.max(startLine, endLine)
  const set = side === 'LEFT' ? commentable.left : commentable.right

  if (set.size === 0) {
    return { start: from, end: to }
  }

  let best: { start: number; end: number } | null = null
  let runStart: number | null = null
  let runEnd: number | null = null

  for (let line = from; line <= to; line += 1) {
    if (set.has(line)) {
      if (runStart === null) runStart = line
      runEnd = line
      continue
    }
    if (runStart !== null && runEnd !== null) {
      best = longerRange(best, { start: runStart, end: runEnd })
      runStart = null
      runEnd = null
    }
  }
  if (runStart !== null && runEnd !== null) {
    best = longerRange(best, { start: runStart, end: runEnd })
  }
  return best
}

/**
 * Map a preferred line span onto GitHub-commentable lines.
 * 1) Prefer overlap with the selection
 * 2) Else nearest contiguous commentable run (rich view shows the full file;
 *    GitHub only accepts lines that appear in the PR diff)
 * Empty commentable sets mean "unknown" (no patch) — pass the range through.
 * Always returns a range when possible so the Comment UI can still open.
 */
export function snapToCommentableRange(
  side: ReviewSide,
  startLine: number,
  endLine: number,
  commentable: CommentableLines,
  _block?: { srcFrom: number; srcTo: number } | null,
): { start: number; end: number } | null {
  const from = Math.min(startLine, endLine)
  const to = Math.max(startLine, endLine)
  if (!Number.isFinite(from) || !Number.isFinite(to)) {
    return null
  }

  const set = side === 'LEFT' ? commentable.left : commentable.right
  if (set.size === 0) {
    return { start: from, end: to }
  }

  return (
    clampRangeToDiff(side, startLine, endLine, commentable) ??
    nearestCommentableRange(side, startLine, endLine, commentable) ?? {
      start: from,
      end: to,
    }
  )
}

/** Contiguous commentable run closest to the preferred span. */
export function nearestCommentableRange(
  side: ReviewSide,
  startLine: number,
  endLine: number,
  commentable: CommentableLines,
): { start: number; end: number } | null {
  const from = Math.min(startLine, endLine)
  const to = Math.max(startLine, endLine)
  const set = side === 'LEFT' ? commentable.left : commentable.right
  if (set.size === 0) return null

  let bestLine: number | null = null
  let bestDist = Number.POSITIVE_INFINITY
  for (const line of set) {
    const dist =
      line < from ? from - line : line > to ? line - to : 0
    if (dist < bestDist) {
      bestDist = dist
      bestLine = line
    }
  }
  if (bestLine == null) return null

  let start = bestLine
  let end = bestLine
  while (set.has(start - 1)) start -= 1
  while (set.has(end + 1)) end += 1
  return { start, end }
}

function longerRange(
  a: { start: number; end: number } | null,
  b: { start: number; end: number },
): { start: number; end: number } {
  if (!a) return b
  return b.end - b.start >= a.end - a.start ? b : a
}
