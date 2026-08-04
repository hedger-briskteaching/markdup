export type DiffSegment = {
  text: string
  tone?: 'ins' | 'del'
  /** Length in this side's plain text (always `text.length`). */
  srcLen: number
}

/**
 * Word-level diff for inline text in changed rows.
 * Unchanged words have no tone. Deleted words use `del`. Inserted words use `ins`.
 */
export function wordDiff(oldText: string, newText: string): {
  oldSegments: DiffSegment[]
  newSegments: DiffSegment[]
} {
  const oldWords = tokenize(oldText)
  const newWords = tokenize(newText)
  const n = oldWords.length
  const m = newWords.length
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    Array.from({ length: m + 1 }, () => 0),
  )

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (oldWords[i] === newWords[j]) {
        dp[i]![j] = dp[i + 1]![j + 1]! + 1
      } else {
        dp[i]![j] = Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!)
      }
    }
  }

  const oldSegments: DiffSegment[] = []
  const newSegments: DiffSegment[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (oldWords[i] === newWords[j]) {
      pushSeg(oldSegments, oldWords[i]!)
      pushSeg(newSegments, newWords[j]!)
      i++
      j++
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      pushSeg(oldSegments, oldWords[i]!, 'del')
      i++
    } else {
      pushSeg(newSegments, newWords[j]!, 'ins')
      j++
    }
  }
  while (i < n) {
    pushSeg(oldSegments, oldWords[i]!, 'del')
    i++
  }
  while (j < m) {
    pushSeg(newSegments, newWords[j]!, 'ins')
    j++
  }

  return {
    oldSegments: mergeSegments(oldSegments),
    newSegments: mergeSegments(newSegments),
  }
}

function tokenize(text: string): string[] {
  const matches = text.match(/\s+|[^\s]+/g)
  return matches ?? []
}

function pushSeg(
  list: DiffSegment[],
  text: string,
  tone?: 'ins' | 'del',
): void {
  list.push({ text, tone, srcLen: text.length })
}

function mergeSegments(segments: DiffSegment[]): DiffSegment[] {
  if (segments.length === 0) return segments
  const out: DiffSegment[] = [{ ...segments[0]! }]
  for (let i = 1; i < segments.length; i++) {
    const prev = out[out.length - 1]!
    const cur = segments[i]!
    if (prev.tone === cur.tone) {
      prev.text += cur.text
      prev.srcLen += cur.srcLen
    } else {
      out.push({ ...cur })
    }
  }
  return out
}
