import type { ReviewSide } from '../markdown/sourceRange'

export type CreateReviewCommentFields = {
  path: string
  body: string
  commitId: string
  side: ReviewSide
  line: number
  startLine?: number
  startSide?: ReviewSide
}

/**
 * Build GitHub create-comment fields from a source range.
 * Single-line ranges omit start_line.
 * @param args - Body, path, commit, side, and start/end source lines.
 * @returns Fields for the create-review-comment API.
 */
export function createPayloadFromRange(args: {
  body: string
  path: string
  commitId: string
  side: ReviewSide
  startLine: number
  endLine: number
}): CreateReviewCommentFields {
  const { body, path, commitId, side, startLine, endLine } = args
  const line = endLine
  if (startLine === endLine) {
    return { path, body, commitId, side, line }
  }
  return {
    path,
    body,
    commitId,
    side,
    line,
    startLine,
    startSide: side,
  }
}
