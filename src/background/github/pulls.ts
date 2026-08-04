import { githubFetch } from './client'
import { getAccessToken } from './auth'
import type { ReviewSide } from '../../markdown/sourceRange'
import {
  createPayloadFromRange,
  type CreateReviewCommentFields,
} from '../../shared/reviewComment'

export { createPayloadFromRange }
export type { CreateReviewCommentFields }

export type PullReviewComment = {
  id: number
  body: string
  path: string
  side: ReviewSide | null
  line: number | null
  startLine: number | null
  originalLine: number | null
  inReplyToId: number | null
  userLogin: string
  createdAt: string
  commitId: string
  htmlUrl: string
}

export type ReviewThread = {
  rootId: number
  path: string
  side: ReviewSide
  /** First line of the anchored span (1-based). */
  startLine: number
  /** Last line of the anchored span (1-based). */
  line: number
  comments: PullReviewComment[]
}

export type ThreadIndex = {
  owner: string
  repo: string
  pullNumber: number
  path: string
  threads: ReviewThread[]
}

export type CreateReviewCommentInput = {
  owner: string
  repo: string
  pullNumber: number
  path: string
  body: string
  commitId: string
  side: ReviewSide
  line: number
  startLine?: number
  startSide?: ReviewSide
}

type ApiComment = {
  id: number
  body: string
  path: string
  side?: string | null
  line?: number | null
  start_line?: number | null
  original_line?: number | null
  in_reply_to_id?: number | null
  user?: { login?: string } | null
  created_at: string
  commit_id: string
  html_url: string
}

/**
 * List pull review comments and group them into threads for one file path.
 */
export async function fetchThreadIndex(
  owner: string,
  repo: string,
  pullNumber: number,
  path: string,
): Promise<ThreadIndex> {
  const token = await getAccessToken()
  if (!token) {
    throw new Error('Connect to GitHub before loading review comments.')
  }

  const comments = await listPullReviewComments(
    owner,
    repo,
    pullNumber,
    token,
  )
  const forPath = comments.filter((c) => c.path === path)
  return {
    owner,
    repo,
    pullNumber,
    path,
    threads: buildThreads(forPath),
  }
}

export async function listPullReviewComments(
  owner: string,
  repo: string,
  pullNumber: number,
  token: string,
): Promise<PullReviewComment[]> {
  const raw = await githubFetch<ApiComment[]>(
    `/repos/${owner}/${repo}/pulls/${pullNumber}/comments?per_page=100`,
    { token },
  )
  return raw.map(normalizeComment)
}

export async function createReviewComment(
  input: CreateReviewCommentInput,
): Promise<PullReviewComment> {
  const token = await getAccessToken()
  if (!token) {
    throw new Error('Connect to GitHub before posting a review comment.')
  }

  const body: Record<string, unknown> = {
    body: input.body,
    commit_id: input.commitId,
    path: input.path,
    line: input.line,
    side: input.side,
  }

  if (
    input.startLine != null &&
    input.startLine !== input.line
  ) {
    body.start_line = input.startLine
    body.start_side = input.startSide ?? input.side
  }

  const raw = await githubFetch<ApiComment>(
    `/repos/${input.owner}/${input.repo}/pulls/${input.pullNumber}/comments`,
    {
      token,
      method: 'POST',
      body,
    },
  )
  return normalizeComment(raw)
}

/**
 * Group flat review comments into root threads (replies nest under roots).
 * Only threads with a resolvable line + side are kept.
 */
export function buildThreads(comments: PullReviewComment[]): ReviewThread[] {
  const byId = new Map(comments.map((c) => [c.id, c]))
  const replies = new Map<number, PullReviewComment[]>()
  const roots: PullReviewComment[] = []

  for (const comment of comments) {
    if (comment.inReplyToId != null && byId.has(comment.inReplyToId)) {
      const list = replies.get(comment.inReplyToId) ?? []
      list.push(comment)
      replies.set(comment.inReplyToId, list)
      continue
    }
    roots.push(comment)
  }

  const threads: ReviewThread[] = []
  for (const root of roots) {
    const side = root.side
    const line = root.line ?? root.originalLine
    if (!side || line == null) {
      continue
    }
    const startLine = root.startLine ?? line
    const nested = collectThreadComments(root, replies)
    threads.push({
      rootId: root.id,
      path: root.path,
      side,
      startLine,
      line,
      comments: nested,
    })
  }

  threads.sort((a, b) => {
    if (a.startLine !== b.startLine) return a.startLine - b.startLine
    return a.rootId - b.rootId
  })
  return threads
}

function collectThreadComments(
  root: PullReviewComment,
  replies: Map<number, PullReviewComment[]>,
): PullReviewComment[] {
  const out: PullReviewComment[] = [root]
  const queue = [root.id]
  while (queue.length > 0) {
    const id = queue.shift()!
    const kids = replies.get(id) ?? []
    for (const kid of kids) {
      out.push(kid)
      queue.push(kid.id)
    }
  }
  out.sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )
  return out
}

function normalizeComment(raw: ApiComment): PullReviewComment {
  const side =
    raw.side === 'LEFT' || raw.side === 'RIGHT' ? raw.side : null
  return {
    id: raw.id,
    body: raw.body,
    path: raw.path,
    side,
    line: raw.line ?? null,
    startLine: raw.start_line ?? null,
    originalLine: raw.original_line ?? null,
    inReplyToId: raw.in_reply_to_id ?? null,
    userLogin: raw.user?.login ?? '',
    createdAt: raw.created_at,
    commitId: raw.commit_id,
    htmlUrl: raw.html_url,
  }
}
