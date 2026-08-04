import { githubFetch, GitHubApiError } from './client'
import { getAccessToken, getStoredLogin } from './auth'
import {
  clampRangeToDiff,
  parseCommentableLines,
  type CommentableLines,
} from '../../shared/commentableLines'
import type { ReviewSide } from '../../markdown/sourceRange'
import {
  createPayloadFromRange,
  type CreateReviewCommentFields,
} from '../../shared/reviewComment'
import { fetchPullRequestNodeId, githubGraphql } from './graphql'

export { createPayloadFromRange, clampRangeToDiff, parseCommentableLines }
export type { CreateReviewCommentFields, CommentableLines }

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
  pullRequestReviewId: number | null
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
  /** True when the root comment belongs to an unsubmitted review. */
  pending: boolean
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
  node_id?: string
  body: string
  path: string
  side?: string | null
  start_side?: string | null
  line?: number | null
  start_line?: number | null
  original_line?: number | null
  in_reply_to_id?: number | null
  user?: { login?: string } | null
  created_at: string
  commit_id: string
  html_url: string
  pull_request_review_id?: number | null
}

type ApiReview = {
  id: number
  node_id: string
  state: string
  user?: { login?: string } | null
}

type PendingReviewRef = {
  id: number
  nodeId: string
}

/**
 * List pull review threads for one file path (includes pending drafts).
 * Uses GraphQL — REST often returns pending comments with null line/side.
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

  const threads = await listReviewThreadsGraphql(
    owner,
    repo,
    pullNumber,
    path,
    token,
  )
  return {
    owner,
    repo,
    pullNumber,
    path,
    threads,
  }
}

type GraphqlThreadNode = {
  path: string
  line: number | null
  startLine: number | null
  originalLine: number | null
  diffSide: 'LEFT' | 'RIGHT' | null
  comments: {
    nodes: Array<{
      databaseId: number
      body: string
      createdAt: string
      url: string
      author: { login: string } | null
      commit: { oid: string } | null
      pullRequestReview: {
        databaseId: number
        state: string
      } | null
      replyTo: { databaseId: number } | null
    }>
  }
}

/** Paginate GraphQL reviewThreads and keep those on `path`. */
export async function listReviewThreadsGraphql(
  owner: string,
  repo: string,
  pullNumber: number,
  path: string,
  token: string,
): Promise<ReviewThread[]> {
  const threads: ReviewThread[] = []
  let cursor: string | null = null

  for (let page = 0; page < 20; page += 1) {
    const data: {
      repository: {
        pullRequest: {
          reviewThreads: {
            pageInfo: { hasNextPage: boolean; endCursor: string | null }
            nodes: GraphqlThreadNode[]
          }
        } | null
      } | null
    } = await githubGraphql(
      token,
      `query($owner:String!,$repo:String!,$number:Int!,$after:String) {
        repository(owner:$owner, name:$repo) {
          pullRequest(number:$number) {
            reviewThreads(first:100, after:$after) {
              pageInfo { hasNextPage endCursor }
              nodes {
                path
                line
                startLine
                originalLine
                diffSide
                comments(first:50) {
                  nodes {
                    databaseId
                    body
                    createdAt
                    url
                    author { login }
                    commit { oid }
                    pullRequestReview { databaseId state }
                    replyTo { databaseId }
                  }
                }
              }
            }
          }
        }
      }`,
      { owner, repo, number: pullNumber, after: cursor },
    )

    const connection = data.repository?.pullRequest?.reviewThreads
    if (!connection) break

    for (const node of connection.nodes) {
      if (node.path !== path) continue
      const thread = threadFromGraphqlNode(node)
      if (thread) threads.push(thread)
    }

    if (!connection.pageInfo.hasNextPage || !connection.pageInfo.endCursor) {
      break
    }
    cursor = connection.pageInfo.endCursor
  }

  threads.sort((a, b) => {
    if (a.startLine !== b.startLine) return a.startLine - b.startLine
    return a.rootId - b.rootId
  })
  return threads
}

/** @internal Exported for tests. */
export function threadFromGraphqlNode(
  node: GraphqlThreadNode,
): ReviewThread | null {
  const side = node.diffSide
  const line = node.line ?? node.originalLine
  if (!side || line == null) return null

  const comments = node.comments.nodes.map((c) => ({
    id: c.databaseId,
    body: c.body,
    path: node.path,
    side,
    line: node.line,
    startLine: node.startLine,
    originalLine: node.originalLine,
    inReplyToId: c.replyTo?.databaseId ?? null,
    userLogin: c.author?.login ?? '',
    createdAt: c.createdAt,
    commitId: c.commit?.oid ?? '',
    htmlUrl: c.url,
    pullRequestReviewId: c.pullRequestReview?.databaseId ?? null,
  }))

  const root = comments.find((c) => c.inReplyToId == null) ?? comments[0]
  if (!root) return null

  const ordered = [
    root,
    ...comments
      .filter((c) => c.id !== root.id)
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
  ]

  const pending = node.comments.nodes.some(
    (c) => c.pullRequestReview?.state === 'PENDING',
  )

  return {
    rootId: root.id,
    path: node.path,
    side,
    startLine: node.startLine ?? line,
    line,
    comments: ordered,
    pending,
  }
}

export async function listPullReviewComments(
  owner: string,
  repo: string,
  pullNumber: number,
  token: string,
): Promise<PullReviewComment[]> {
  const out: PullReviewComment[] = []
  for (let page = 1; page <= 10; page += 1) {
    const raw = await githubFetch<ApiComment[]>(
      `/repos/${owner}/${repo}/pulls/${pullNumber}/comments?per_page=100&page=${page}`,
      { token },
    )
    out.push(...raw.map(normalizeComment))
    if (raw.length < 100) break
  }
  return out
}

export async function listPullReviews(
  owner: string,
  repo: string,
  pullNumber: number,
  token: string,
): Promise<ApiReview[]> {
  return githubFetch<ApiReview[]>(
    `/repos/${owner}/${repo}/pulls/${pullNumber}/reviews?per_page=100`,
    { token },
  )
}

/**
 * Find the current user's PENDING review on this PR, if any.
 * GitHub allows only one pending review per user per pull request.
 */
export async function findPendingReview(
  owner: string,
  repo: string,
  pullNumber: number,
  token: string,
  login: string,
): Promise<PendingReviewRef | null> {
  const reviews = await listPullReviews(owner, repo, pullNumber, token)
  const pending = reviews.find(
    (r) =>
      r.state === 'PENDING' &&
      r.user?.login != null &&
      r.user.login.toLowerCase() === login.toLowerCase(),
  )
  if (!pending?.node_id) return null
  return { id: pending.id, nodeId: pending.node_id }
}

/** @deprecated use findPendingReview */
export async function findPendingReviewId(
  owner: string,
  repo: string,
  pullNumber: number,
  token: string,
  login: string,
): Promise<number | null> {
  const pending = await findPendingReview(owner, repo, pullNumber, token, login)
  return pending?.id ?? null
}

export async function createReviewComment(
  input: CreateReviewCommentInput,
): Promise<PullReviewComment> {
  const token = await getAccessToken()
  if (!token) {
    throw new Error('Connect to GitHub before posting a review comment.')
  }

  const commentable = await fetchCommentableLines(
    input.owner,
    input.repo,
    input.pullNumber,
    input.path,
    token,
  )

  const start = input.startLine ?? input.line
  const end = input.line
  const clamped = clampRangeToDiff(input.side, start, end, commentable)
  if (!clamped) {
    throw new Error(
      'GitHub only allows review comments on lines that appear in the pull request diff. Select text on or near a changed (green/red) line — unchanged lines outside the diff cannot be commented on.',
    )
  }

  const login = await getStoredLogin()
  const pullNodeId = await fetchPullRequestNodeId(
    input.owner,
    input.repo,
    input.pullNumber,
    token,
  )

  let pending =
    login != null
      ? await findPendingReview(
          input.owner,
          input.repo,
          input.pullNumber,
          token,
          login,
        )
      : null

  if (!pending) {
    pending = await createEmptyPendingReview(
      input.owner,
      input.repo,
      input.pullNumber,
      input.commitId,
      pullNodeId,
      token,
    )
  }

  try {
    return await addThreadToPendingReviewGraphql({
      token,
      pullNodeId,
      reviewNodeId: pending.nodeId,
      reviewDatabaseId: pending.id,
      path: input.path,
      body: input.body,
      side: input.side,
      line: clamped.end,
      startLine: clamped.start !== clamped.end ? clamped.start : undefined,
      startSide:
        clamped.start !== clamped.end
          ? (input.startSide ?? input.side)
          : undefined,
      commitId: input.commitId,
    })
  } catch (error) {
    if (isPendingReviewConflict(error) && login) {
      const again = await findPendingReview(
        input.owner,
        input.repo,
        input.pullNumber,
        token,
        login,
      )
      if (again) {
        return addThreadToPendingReviewGraphql({
          token,
          pullNodeId,
          reviewNodeId: again.nodeId,
          reviewDatabaseId: again.id,
          path: input.path,
          body: input.body,
          side: input.side,
          line: clamped.end,
          startLine: clamped.start !== clamped.end ? clamped.start : undefined,
          startSide:
            clamped.start !== clamped.end
              ? (input.startSide ?? input.side)
              : undefined,
          commitId: input.commitId,
        })
      }
    }
    throw error
  }
}

/**
 * Start an empty pending review. Adding threads uses GraphQL — REST cannot
 * append comments to a pending review (returns 404 Not Found).
 */
async function createEmptyPendingReview(
  owner: string,
  repo: string,
  pullNumber: number,
  commitId: string,
  pullNodeId: string,
  token: string,
): Promise<PendingReviewRef> {
  try {
    const review = await githubFetch<ApiReview>(
      `/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`,
      {
        token,
        method: 'POST',
        body: {
          commit_id: commitId,
          // Omit `event` so the review stays PENDING.
        },
      },
    )
    if (!review.node_id) {
      throw new Error('Created a pending review without a node id.')
    }
    return { id: review.id, nodeId: review.node_id }
  } catch (error) {
    if (isPendingReviewConflict(error)) {
      throw error
    }
    const data = await githubGraphql<{
      addPullRequestReview: {
        pullRequestReview: { id: string; databaseId: number }
      }
    }>(
      token,
      `mutation($pullRequestId: ID!, $commitOID: GitObjectID) {
        addPullRequestReview(input: {
          pullRequestId: $pullRequestId
          commitOID: $commitOID
        }) {
          pullRequestReview { id databaseId }
        }
      }`,
      { pullRequestId: pullNodeId, commitOID: commitId },
    )
    const created = data.addPullRequestReview.pullRequestReview
    return { id: created.databaseId, nodeId: created.id }
  }
}

type GraphqlReviewComment = {
  databaseId: number
  body: string
  url: string
  createdAt: string
  commit: { oid: string } | null
  author: { login: string } | null
  pullRequestReview: { databaseId: number } | null
}

type GraphqlReviewThread = {
  path: string
  line: number | null
  startLine: number | null
  originalLine: number | null
  diffSide: 'LEFT' | 'RIGHT' | null
  comments: { nodes: GraphqlReviewComment[] }
}

async function addThreadToPendingReviewGraphql(args: {
  token: string
  pullNodeId: string
  reviewNodeId: string
  reviewDatabaseId: number
  path: string
  body: string
  side: ReviewSide
  line: number
  startLine?: number
  startSide?: ReviewSide
  commitId: string
}): Promise<PullReviewComment> {
  const input: Record<string, unknown> = {
    pullRequestId: args.pullNodeId,
    pullRequestReviewId: args.reviewNodeId,
    path: args.path,
    body: args.body,
    line: args.line,
    side: args.side,
  }
  if (args.startLine != null) {
    input.startLine = args.startLine
    input.startSide = args.startSide ?? args.side
  }

  const data = await githubGraphql<{
    addPullRequestReviewThread: {
      thread: GraphqlReviewThread | null
    }
  }>(
    args.token,
    `mutation($input: AddPullRequestReviewThreadInput!) {
      addPullRequestReviewThread(input: $input) {
        thread {
          path
          line
          startLine
          originalLine
          diffSide
          comments(first: 1) {
            nodes {
              databaseId
              body
              url
              createdAt
              commit { oid }
              author { login }
              pullRequestReview { databaseId }
            }
          }
        }
      }
    }`,
    { input },
  )

  const thread = data.addPullRequestReviewThread.thread
  const node = thread?.comments.nodes[0] ?? null
  if (!thread || !node) {
    throw new Error('GitHub did not return the new review comment.')
  }

  return {
    id: node.databaseId,
    body: node.body,
    path: thread.path || args.path,
    side:
      thread.diffSide === 'LEFT' || thread.diffSide === 'RIGHT'
        ? thread.diffSide
        : args.side,
    line: thread.line ?? args.line,
    startLine: thread.startLine,
    originalLine: thread.originalLine,
    inReplyToId: null,
    userLogin: node.author?.login ?? '',
    createdAt: node.createdAt,
    commitId: node.commit?.oid ?? args.commitId,
    htmlUrl: node.url,
    pullRequestReviewId:
      node.pullRequestReview?.databaseId ?? args.reviewDatabaseId,
  }
}

export function isPendingReviewConflict(error: unknown): boolean {
  if (!(error instanceof GitHubApiError)) return false
  const message = error.message.toLowerCase()
  return (
    message.includes('one pending review') ||
    message.includes('only have one pending review')
  )
}

type PullFileEntry = {
  filename: string
  previous_filename?: string
  patch?: string
  status?: string
}

export async function fetchCommentableLines(
  owner: string,
  repo: string,
  pullNumber: number,
  path: string,
  token: string,
): Promise<CommentableLines> {
  for (let page = 1; page <= 20; page += 1) {
    const files = await githubFetch<PullFileEntry[]>(
      `/repos/${owner}/${repo}/pulls/${pullNumber}/files?per_page=100&page=${page}`,
      { token },
    )
    const file = files.find(
      (f) => f.filename === path || f.previous_filename === path,
    )
    if (file) {
      if (!file.patch) {
        // New empty file / binary / too large for patch — let GitHub decide.
        return { left: new Set(), right: new Set() }
      }
      return parseCommentableLines(file.patch)
    }
    if (files.length < 100) break
  }
  return { left: new Set(), right: new Set() }
}

/**
 * Group flat review comments into root threads (replies nest under roots).
 * Only threads with a resolvable line + side are kept.
 */
export function buildThreads(
  comments: PullReviewComment[],
  pendingReviewIds: Set<number> = new Set(),
): ReviewThread[] {
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
    const pending =
      root.pullRequestReviewId != null &&
      pendingReviewIds.has(root.pullRequestReviewId)
    threads.push({
      rootId: root.id,
      path: root.path,
      side,
      startLine,
      line,
      comments: nested,
      pending,
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
  const side = normalizeSide(raw)
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
    pullRequestReviewId: raw.pull_request_review_id ?? null,
  }
}

function normalizeSide(raw: ApiComment): ReviewSide | null {
  if (raw.side === 'LEFT' || raw.side === 'RIGHT') return raw.side
  if (raw.start_side === 'LEFT' || raw.start_side === 'RIGHT') {
    return raw.start_side
  }
  // Older comments omit side; line comments default to the head (After).
  if (raw.line != null || raw.original_line != null) {
    return 'RIGHT'
  }
  return null
}

export type ReplyReviewCommentInput = {
  owner: string
  repo: string
  pullNumber: number
  inReplyToId: number
  body: string
}

/**
 * Reply to an existing review comment (must be a top-level root, not a reply).
 * Uses the dedicated replies endpoint — POST .../comments with in_reply_to
 * returns 404 for pending-review threads.
 */
export async function replyToReviewComment(
  input: ReplyReviewCommentInput,
): Promise<PullReviewComment> {
  const token = await getAccessToken()
  if (!token) {
    throw new Error('Connect to GitHub before posting a reply.')
  }
  const login = await getStoredLogin()

  // Prefer GraphQL on the pending review so the reply stays in the draft.
  const pending =
    login != null
      ? await findPendingReview(
          input.owner,
          input.repo,
          input.pullNumber,
          token,
          login,
        )
      : null

  if (pending) {
    try {
      return await addReplyViaThreadGraphql({
        token,
        owner: input.owner,
        repo: input.repo,
        pullNumber: input.pullNumber,
        reviewNodeId: pending.nodeId,
        reviewDatabaseId: pending.id,
        inReplyToId: input.inReplyToId,
        body: input.body,
      })
    } catch (error) {
      // Fall through to the REST replies endpoint.
      if (!(error instanceof GitHubApiError) || error.status !== 404) {
        // Keep trying REST for transient GraphQL shape issues; rethrow hard auth.
        const message =
          error instanceof Error ? error.message.toLowerCase() : ''
        if (message.includes('bad credentials') || message.includes('401')) {
          throw error
        }
      }
    }
  }

  return replyViaRest(input, token)
}

async function replyViaRest(
  input: ReplyReviewCommentInput,
  token: string,
): Promise<PullReviewComment> {
  // https://docs.github.com/en/rest/pulls/comments#create-a-reply-for-a-review-comment
  const raw = await githubFetch<ApiComment>(
    `/repos/${input.owner}/${input.repo}/pulls/${input.pullNumber}/comments/${input.inReplyToId}/replies`,
    {
      token,
      method: 'POST',
      body: {
        body: input.body,
      },
    },
  )
  return normalizeComment(raw)
}

/**
 * Resolve the review thread that owns `inReplyToId`, then add a reply via
 * addPullRequestReviewThreadReply (works on pending drafts).
 */
async function addReplyViaThreadGraphql(args: {
  token: string
  owner: string
  repo: string
  pullNumber: number
  reviewNodeId: string
  reviewDatabaseId: number
  inReplyToId: number
  body: string
}): Promise<PullReviewComment> {
  const threadId = await findReviewThreadNodeIdForComment(
    args.owner,
    args.repo,
    args.pullNumber,
    args.inReplyToId,
    args.token,
  )
  if (!threadId) {
    throw new GitHubApiError(
      'Could not find the review thread for this comment.',
      404,
    )
  }

  const data = await githubGraphql<{
    addPullRequestReviewThreadReply: {
      comment: GraphqlReviewComment & {
        replyTo: { databaseId: number } | null
      }
    }
  }>(
    args.token,
    `mutation(
      $pullRequestReviewId: ID!
      $pullRequestReviewThreadId: ID!
      $body: String!
    ) {
      addPullRequestReviewThreadReply(input: {
        pullRequestReviewId: $pullRequestReviewId
        pullRequestReviewThreadId: $pullRequestReviewThreadId
        body: $body
      }) {
        comment {
          databaseId
          body
          url
          createdAt
          commit { oid }
          author { login }
          pullRequestReview { databaseId }
          replyTo { databaseId }
        }
      }
    }`,
    {
      pullRequestReviewId: args.reviewNodeId,
      pullRequestReviewThreadId: threadId,
      body: args.body,
    },
  )

  const node = data.addPullRequestReviewThreadReply.comment
  if (!node) {
    throw new Error('GitHub did not return the reply comment.')
  }
  return {
    id: node.databaseId,
    body: node.body,
    path: '',
    side: null,
    line: null,
    startLine: null,
    originalLine: null,
    inReplyToId: node.replyTo?.databaseId ?? args.inReplyToId,
    userLogin: node.author?.login ?? '',
    createdAt: node.createdAt,
    commitId: node.commit?.oid ?? '',
    htmlUrl: node.url,
    pullRequestReviewId:
      node.pullRequestReview?.databaseId ?? args.reviewDatabaseId,
  }
}

async function findReviewThreadNodeIdForComment(
  owner: string,
  repo: string,
  pullNumber: number,
  commentDatabaseId: number,
  token: string,
): Promise<string | null> {
  type ThreadLookup = {
    repository: {
      pullRequest: {
        reviewThreads: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null }
          nodes: Array<{
            id: string
            comments: { nodes: Array<{ databaseId: number | null }> }
          }>
        }
      } | null
    } | null
  }

  let after: string | null = null
  for (let page = 0; page < 20; page += 1) {
    const data: ThreadLookup = await githubGraphql<ThreadLookup>(
      token,
      `query($owner: String!, $repo: String!, $number: Int!, $after: String) {
        repository(owner: $owner, name: $repo) {
          pullRequest(number: $number) {
            reviewThreads(first: 50, after: $after) {
              pageInfo { hasNextPage endCursor }
              nodes {
                id
                comments(first: 50) {
                  nodes { databaseId }
                }
              }
            }
          }
        }
      }`,
      { owner, repo, number: pullNumber, after },
    )

    const connection = data.repository?.pullRequest?.reviewThreads
    if (!connection) return null

    for (const thread of connection.nodes) {
      if (
        thread.comments.nodes.some(
          (c: { databaseId: number | null }) =>
            c.databaseId === commentDatabaseId,
        )
      ) {
        return thread.id
      }
    }

    if (!connection.pageInfo.hasNextPage || !connection.pageInfo.endCursor) {
      break
    }
    after = connection.pageInfo.endCursor
  }
  return null
}

export type UpdateReviewCommentInput = {
  owner: string
  repo: string
  commentId: number
  body: string
}

export async function updateReviewComment(
  input: UpdateReviewCommentInput,
): Promise<PullReviewComment> {
  const token = await getAccessToken()
  if (!token) {
    throw new Error('Connect to GitHub before editing a comment.')
  }
  const raw = await githubFetch<ApiComment>(
    `/repos/${input.owner}/${input.repo}/pulls/comments/${input.commentId}`,
    {
      token,
      method: 'PATCH',
      body: { body: input.body },
    },
  )
  return normalizeComment(raw)
}

export type DeleteReviewCommentInput = {
  owner: string
  repo: string
  commentId: number
}

export async function deleteReviewComment(
  input: DeleteReviewCommentInput,
): Promise<void> {
  const token = await getAccessToken()
  if (!token) {
    throw new Error('Connect to GitHub before deleting a comment.')
  }
  await githubFetch(
    `/repos/${input.owner}/${input.repo}/pulls/comments/${input.commentId}`,
    {
      token,
      method: 'DELETE',
    },
  )
}
