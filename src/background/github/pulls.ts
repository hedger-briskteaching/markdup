import { githubFetch, GitHubApiError } from "./client";
import { getAccessToken, getStoredLogin } from "./auth";
import {
  clampRangeToDiff,
  parseCommentableLines,
  type CommentableLines,
} from "../../shared/commentableLines";
import type { ReviewSide } from "../../markdown/sourceRange";
import { createPayloadFromRange, type CreateReviewCommentFields } from "../../shared/reviewComment";
import { fetchPullRequestNodeId, githubGraphql } from "./graphql";

export { createPayloadFromRange, clampRangeToDiff, parseCommentableLines };
export type { CreateReviewCommentFields, CommentableLines };

export type PullReviewComment = {
  id: number;
  body: string;
  path: string;
  side: ReviewSide | null;
  line: number | null;
  startLine: number | null;
  originalLine: number | null;
  inReplyToId: number | null;
  userLogin: string;
  createdAt: string;
  commitId: string;
  htmlUrl: string;
  pullRequestReviewId: number | null;
};

export type ReviewThread = {
  rootId: number;
  path: string;
  side: ReviewSide;
  /** First line of the anchored span (1-based). */
  startLine: number;
  /** Last line of the anchored span (1-based). */
  line: number;
  comments: PullReviewComment[];
  /** True when the root comment belongs to an unsubmitted review. */
  pending: boolean;
};

export type ThreadIndex = {
  owner: string;
  repo: string;
  pullNumber: number;
  path: string;
  threads: ReviewThread[];
};

export type CreateReviewCommentInput = {
  owner: string;
  repo: string;
  pullNumber: number;
  path: string;
  body: string;
  commitId: string;
  side: ReviewSide;
  line: number;
  startLine?: number;
  startSide?: ReviewSide;
};

type ApiComment = {
  id: number;
  node_id?: string;
  body: string;
  path: string;
  side?: string | null;
  start_side?: string | null;
  line?: number | null;
  start_line?: number | null;
  original_line?: number | null;
  in_reply_to_id?: number | null;
  user?: { login?: string } | null;
  created_at: string;
  commit_id: string;
  html_url: string;
  pull_request_review_id?: number | null;
};

type ApiReview = {
  id: number;
  node_id: string;
  state: string;
  user?: { login?: string } | null;
};

type PendingReviewRef = {
  id: number;
  nodeId: string;
};

/**
 * List pull review threads for one file path, including pending drafts.
 * Uses GraphQL because REST often returns pending comments with null line/side.
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param pullNumber - Pull request number.
 * @param path - File path to filter threads by.
 * @returns A ThreadIndex containing all threads anchored to the given path.
 */
export async function fetchThreadIndex(
  owner: string,
  repo: string,
  pullNumber: number,
  path: string,
): Promise<ThreadIndex> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error("Connect to GitHub before loading review comments.");
  }

  const threads = await listReviewThreadsGraphql(owner, repo, pullNumber, path, token);
  return {
    owner,
    repo,
    pullNumber,
    path,
    threads,
  };
}

type GraphqlThreadNode = {
  path: string;
  line: number | null;
  startLine: number | null;
  originalLine: number | null;
  diffSide: "LEFT" | "RIGHT" | null;
  comments: {
    nodes: Array<{
      databaseId: number;
      body: string;
      createdAt: string;
      url: string;
      author: { login: string } | null;
      commit: { oid: string } | null;
      pullRequestReview: {
        databaseId: number;
        state: string;
      } | null;
      replyTo: { databaseId: number } | null;
    }>;
  };
};

/**
 * Paginate GraphQL reviewThreads and keep only those on the given path.
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param pullNumber - Pull request number.
 * @param path - File path to match against thread anchors.
 * @param token - GitHub access token.
 * @returns Sorted array of ReviewThread objects for the file.
 */
export async function listReviewThreadsGraphql(
  owner: string,
  repo: string,
  pullNumber: number,
  path: string,
  token: string,
): Promise<ReviewThread[]> {
  const threads: ReviewThread[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < 20; page += 1) {
    const data: {
      repository: {
        pullRequest: {
          reviewThreads: {
            pageInfo: { hasNextPage: boolean; endCursor: string | null };
            nodes: GraphqlThreadNode[];
          };
        } | null;
      } | null;
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
    );

    const connection = data.repository?.pullRequest?.reviewThreads;
    if (!connection) break;

    for (const node of connection.nodes) {
      if (node.path !== path) continue;
      const thread = threadFromGraphqlNode(node);
      if (thread) threads.push(thread);
    }

    if (!connection.pageInfo.hasNextPage || !connection.pageInfo.endCursor) {
      break;
    }
    cursor = connection.pageInfo.endCursor;
  }

  threads.sort((a, b) => {
    if (a.startLine !== b.startLine) return a.startLine - b.startLine;
    return a.rootId - b.rootId;
  });
  return threads;
}

/**
 * Convert a single GraphQL thread node into a ReviewThread.
 * @internal Exported for tests.
 * @param node - Raw GraphQL thread node.
 * @returns A ReviewThread, or null if the node lacks a usable line or side.
 */
export function threadFromGraphqlNode(node: GraphqlThreadNode): ReviewThread | null {
  const side = node.diffSide;
  const line = node.line ?? node.originalLine;
  if (!side || line == null) return null;

  const comments = node.comments.nodes.map((c) => ({
    id: c.databaseId,
    body: c.body,
    path: node.path,
    side,
    line: node.line,
    startLine: node.startLine,
    originalLine: node.originalLine,
    inReplyToId: c.replyTo?.databaseId ?? null,
    userLogin: c.author?.login ?? "",
    createdAt: c.createdAt,
    commitId: c.commit?.oid ?? "",
    htmlUrl: c.url,
    pullRequestReviewId: c.pullRequestReview?.databaseId ?? null,
  }));

  const root = comments.find((c) => c.inReplyToId == null) ?? comments[0];
  if (!root) return null;

  const ordered = [
    root,
    ...comments
      .filter((c) => c.id !== root.id)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
  ];

  const pending = node.comments.nodes.some((c) => c.pullRequestReview?.state === "PENDING");

  return {
    rootId: root.id,
    path: node.path,
    side,
    startLine: node.startLine ?? line,
    line,
    comments: ordered,
    pending,
  };
}

/**
 * Fetch all review comments on a pull request via paginated REST API.
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param pullNumber - Pull request number.
 * @param token - GitHub access token.
 * @returns Array of normalized PullReviewComment objects.
 */
export async function listPullReviewComments(
  owner: string,
  repo: string,
  pullNumber: number,
  token: string,
): Promise<PullReviewComment[]> {
  const out: PullReviewComment[] = [];
  for (let page = 1; page <= 10; page += 1) {
    const raw = await githubFetch<ApiComment[]>(
      `/repos/${owner}/${repo}/pulls/${pullNumber}/comments?per_page=100&page=${page}`,
      { token },
    );
    out.push(...raw.map(normalizeComment));
    if (raw.length < 100) break;
  }
  return out;
}

/**
 * Fetch all reviews on a pull request (one page, up to 100).
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param pullNumber - Pull request number.
 * @param token - GitHub access token.
 * @returns Array of raw ApiReview objects.
 */
export async function listPullReviews(
  owner: string,
  repo: string,
  pullNumber: number,
  token: string,
): Promise<ApiReview[]> {
  return githubFetch<ApiReview[]>(
    `/repos/${owner}/${repo}/pulls/${pullNumber}/reviews?per_page=100`,
    { token },
  );
}

/**
 * Find the current user's PENDING review on this pull request, if any.
 * GitHub allows only one pending review per user per pull request.
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param pullNumber - Pull request number.
 * @param token - GitHub access token.
 * @param login - GitHub username to match against review authors.
 * @returns A PendingReviewRef with the review ID and node ID, or null.
 */
export async function findPendingReview(
  owner: string,
  repo: string,
  pullNumber: number,
  token: string,
  login: string,
): Promise<PendingReviewRef | null> {
  const reviews = await listPullReviews(owner, repo, pullNumber, token);
  const pending = reviews.find(
    (r) =>
      r.state === "PENDING" &&
      r.user?.login != null &&
      r.user.login.toLowerCase() === login.toLowerCase(),
  );
  if (!pending?.node_id) return null;
  return { id: pending.id, nodeId: pending.node_id };
}

/**
 * Find the current user's pending review ID (numeric only).
 * @deprecated Use {@link findPendingReview} instead.
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param pullNumber - Pull request number.
 * @param token - GitHub access token.
 * @param login - GitHub username to match.
 * @returns The numeric review ID, or null.
 */
export async function findPendingReviewId(
  owner: string,
  repo: string,
  pullNumber: number,
  token: string,
  login: string,
): Promise<number | null> {
  const pending = await findPendingReview(owner, repo, pullNumber, token, login);
  return pending?.id ?? null;
}

/**
 * Create a new review comment on a pull request diff.
 * Clamps the line range to commentable diff lines and attaches to a pending review.
 * @param input - All fields needed to create the comment.
 * @returns The created PullReviewComment.
 */
export async function createReviewComment(
  input: CreateReviewCommentInput,
): Promise<PullReviewComment> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error("Connect to GitHub before posting a review comment.");
  }

  const commentable = await fetchCommentableLines(
    input.owner,
    input.repo,
    input.pullNumber,
    input.path,
    token,
  );

  const start = input.startLine ?? input.line;
  const end = input.line;
  const clamped = clampRangeToDiff(input.side, start, end, commentable);
  if (!clamped) {
    throw new Error(
      "GitHub only allows review comments on lines that appear in the pull request diff. Select text on or near a changed (green/red) line — unchanged lines outside the diff cannot be commented on.",
    );
  }

  const login = await getStoredLogin();
  const pullNodeId = await fetchPullRequestNodeId(input.owner, input.repo, input.pullNumber, token);

  let pending =
    login != null
      ? await findPendingReview(input.owner, input.repo, input.pullNumber, token, login)
      : null;

  if (!pending) {
    pending = await createEmptyPendingReview(
      input.owner,
      input.repo,
      input.pullNumber,
      input.commitId,
      pullNodeId,
      token,
    );
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
      startSide: clamped.start !== clamped.end ? (input.startSide ?? input.side) : undefined,
      commitId: input.commitId,
    });
  } catch (error) {
    if (isPendingReviewConflict(error) && login) {
      const again = await findPendingReview(
        input.owner,
        input.repo,
        input.pullNumber,
        token,
        login,
      );
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
          startSide: clamped.start !== clamped.end ? (input.startSide ?? input.side) : undefined,
          commitId: input.commitId,
        });
      }
    }
    throw error;
  }
}

/**
 * Start an empty pending review so threads can be added via GraphQL.
 * REST cannot append comments to a pending review (returns 404 Not Found).
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param pullNumber - Pull request number.
 * @param commitId - Commit SHA to anchor the review to.
 * @param pullNodeId - GraphQL node ID of the pull request.
 * @param token - GitHub access token.
 * @returns A PendingReviewRef for the new review.
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
        method: "POST",
        body: {
          commit_id: commitId,
        },
      },
    );
    if (!review.node_id) {
      throw new Error("Created a pending review without a node id.");
    }
    return { id: review.id, nodeId: review.node_id };
  } catch (error) {
    if (isPendingReviewConflict(error)) {
      throw error;
    }
    const data = await githubGraphql<{
      addPullRequestReview: {
        pullRequestReview: { id: string; databaseId: number };
      };
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
    );
    const created = data.addPullRequestReview.pullRequestReview;
    return { id: created.databaseId, nodeId: created.id };
  }
}

type GraphqlReviewComment = {
  databaseId: number;
  body: string;
  url: string;
  createdAt: string;
  commit: { oid: string } | null;
  author: { login: string } | null;
  pullRequestReview: { databaseId: number } | null;
};

type GraphqlReviewThread = {
  path: string;
  line: number | null;
  startLine: number | null;
  originalLine: number | null;
  diffSide: "LEFT" | "RIGHT" | null;
  comments: { nodes: GraphqlReviewComment[] };
};

/**
 * Add a new review thread to an existing pending review via GraphQL.
 * @param args - Token, node IDs, path, body, side, and line positions.
 * @returns The created PullReviewComment.
 */
async function addThreadToPendingReviewGraphql(args: {
  token: string;
  pullNodeId: string;
  reviewNodeId: string;
  reviewDatabaseId: number;
  path: string;
  body: string;
  side: ReviewSide;
  line: number;
  startLine?: number;
  startSide?: ReviewSide;
  commitId: string;
}): Promise<PullReviewComment> {
  const input: Record<string, unknown> = {
    pullRequestId: args.pullNodeId,
    pullRequestReviewId: args.reviewNodeId,
    path: args.path,
    body: args.body,
    line: args.line,
    side: args.side,
  };
  if (args.startLine != null) {
    input.startLine = args.startLine;
    input.startSide = args.startSide ?? args.side;
  }

  const data = await githubGraphql<{
    addPullRequestReviewThread: {
      thread: GraphqlReviewThread | null;
    };
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
  );

  const thread = data.addPullRequestReviewThread.thread;
  const node = thread?.comments.nodes[0] ?? null;
  if (!thread || !node) {
    throw new Error("GitHub did not return the new review comment.");
  }

  return {
    id: node.databaseId,
    body: node.body,
    path: thread.path || args.path,
    side: thread.diffSide === "LEFT" || thread.diffSide === "RIGHT" ? thread.diffSide : args.side,
    line: thread.line ?? args.line,
    startLine: thread.startLine,
    originalLine: thread.originalLine,
    inReplyToId: null,
    userLogin: node.author?.login ?? "",
    createdAt: node.createdAt,
    commitId: node.commit?.oid ?? args.commitId,
    htmlUrl: node.url,
    pullRequestReviewId: node.pullRequestReview?.databaseId ?? args.reviewDatabaseId,
  };
}

/**
 * Make sure the error is a "one pending review" conflict from GitHub.
 * @param error - The caught error value.
 * @returns True if the error message indicates a pending-review conflict.
 */
export function isPendingReviewConflict(error: unknown): boolean {
  if (!(error instanceof GitHubApiError)) return false;
  const message = error.message.toLowerCase();
  return message.includes("one pending review") || message.includes("only have one pending review");
}

type PullFileEntry = {
  filename: string;
  previous_filename?: string;
  patch?: string;
  status?: string;
};

/**
 * Fetch the set of commentable lines for a file in a pull request diff.
 * Paginates through the files list until the target path is found.
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param pullNumber - Pull request number.
 * @param path - File path to find in the diff.
 * @param token - GitHub access token.
 * @returns CommentableLines with left and right line sets.
 */
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
    );
    const file = files.find((f) => f.filename === path || f.previous_filename === path);
    if (file) {
      if (!file.patch) {
        return { left: new Set(), right: new Set() };
      }
      return parseCommentableLines(file.patch);
    }
    if (files.length < 100) break;
  }
  return { left: new Set(), right: new Set() };
}

/**
 * Group flat review comments into threaded conversations by root comment.
 * Only threads with a resolvable line and side are kept.
 * @param comments - Flat array of PullReviewComment objects.
 * @param pendingReviewIds - Set of review IDs that are in PENDING state.
 * @returns Sorted array of ReviewThread objects.
 */
export function buildThreads(
  comments: PullReviewComment[],
  pendingReviewIds: Set<number> = new Set(),
): ReviewThread[] {
  const byId = new Map(comments.map((c) => [c.id, c]));
  const replies = new Map<number, PullReviewComment[]>();
  const roots: PullReviewComment[] = [];

  for (const comment of comments) {
    if (comment.inReplyToId != null && byId.has(comment.inReplyToId)) {
      const list = replies.get(comment.inReplyToId) ?? [];
      list.push(comment);
      replies.set(comment.inReplyToId, list);
      continue;
    }
    roots.push(comment);
  }

  const threads: ReviewThread[] = [];
  for (const root of roots) {
    const side = root.side;
    const line = root.line ?? root.originalLine;
    if (!side || line == null) {
      continue;
    }
    const startLine = root.startLine ?? line;
    const nested = collectThreadComments(root, replies);
    const pending =
      root.pullRequestReviewId != null && pendingReviewIds.has(root.pullRequestReviewId);
    threads.push({
      rootId: root.id,
      path: root.path,
      side,
      startLine,
      line,
      comments: nested,
      pending,
    });
  }

  threads.sort((a, b) => {
    if (a.startLine !== b.startLine) return a.startLine - b.startLine;
    return a.rootId - b.rootId;
  });
  return threads;
}

/**
 * Collect all nested replies for a root comment using breadth-first traversal.
 * @param root - The root comment of the thread.
 * @param replies - Map from comment ID to its direct replies.
 * @returns All comments in the thread sorted by creation time.
 */
function collectThreadComments(
  root: PullReviewComment,
  replies: Map<number, PullReviewComment[]>,
): PullReviewComment[] {
  const out: PullReviewComment[] = [root];
  const queue = [root.id];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const kids = replies.get(id) ?? [];
    for (const kid of kids) {
      out.push(kid);
      queue.push(kid.id);
    }
  }
  out.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return out;
}

/**
 * Convert a raw API comment into the normalized PullReviewComment shape.
 * @param raw - Raw comment object from the GitHub REST API.
 * @returns Normalized PullReviewComment.
 */
function normalizeComment(raw: ApiComment): PullReviewComment {
  const side = normalizeSide(raw);
  return {
    id: raw.id,
    body: raw.body,
    path: raw.path,
    side,
    line: raw.line ?? null,
    startLine: raw.start_line ?? null,
    originalLine: raw.original_line ?? null,
    inReplyToId: raw.in_reply_to_id ?? null,
    userLogin: raw.user?.login ?? "",
    createdAt: raw.created_at,
    commitId: raw.commit_id,
    htmlUrl: raw.html_url,
    pullRequestReviewId: raw.pull_request_review_id ?? null,
  };
}

/**
 * Determine the diff side for a comment from its API fields.
 * Falls back to RIGHT for older comments that omit the side field.
 * @param raw - Raw comment object from the GitHub REST API.
 * @returns The ReviewSide string, or null if indeterminate.
 */
function normalizeSide(raw: ApiComment): ReviewSide | null {
  if (raw.side === "LEFT" || raw.side === "RIGHT") return raw.side;
  if (raw.start_side === "LEFT" || raw.start_side === "RIGHT") {
    return raw.start_side;
  }
  if (raw.line != null || raw.original_line != null) {
    return "RIGHT";
  }
  return null;
}

export type ReplyReviewCommentInput = {
  owner: string;
  repo: string;
  pullNumber: number;
  inReplyToId: number;
  body: string;
};

/**
 * Reply to an existing review comment thread.
 * Prefers GraphQL when a pending review exists so the reply stays in the draft.
 * Falls back to the REST replies endpoint otherwise.
 * @param input - Owner, repo, pull number, root comment ID, and reply body.
 * @returns The created reply as a PullReviewComment.
 */
export async function replyToReviewComment(
  input: ReplyReviewCommentInput,
): Promise<PullReviewComment> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error("Connect to GitHub before posting a reply.");
  }
  const login = await getStoredLogin();

  const pending =
    login != null
      ? await findPendingReview(input.owner, input.repo, input.pullNumber, token, login)
      : null;

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
      });
    } catch (error) {
      if (!(error instanceof GitHubApiError) || error.status !== 404) {
        const message = error instanceof Error ? error.message.toLowerCase() : "";
        if (message.includes("bad credentials") || message.includes("401")) {
          throw error;
        }
      }
    }
  }

  return replyViaRest(input, token);
}

/**
 * Post a reply to a review comment using the REST replies endpoint.
 * @param input - Reply input with owner, repo, pull number, and body.
 * @param token - GitHub access token.
 * @returns The created reply as a PullReviewComment.
 */
async function replyViaRest(
  input: ReplyReviewCommentInput,
  token: string,
): Promise<PullReviewComment> {
  const raw = await githubFetch<ApiComment>(
    `/repos/${input.owner}/${input.repo}/pulls/${input.pullNumber}/comments/${input.inReplyToId}/replies`,
    {
      token,
      method: "POST",
      body: {
        body: input.body,
      },
    },
  );
  return normalizeComment(raw);
}

/**
 * Find the thread that owns a comment, then add a reply via GraphQL.
 * Works on pending drafts where the REST endpoint returns 404.
 * @param args - Token, repo identifiers, review node ID, comment ID, and body.
 * @returns The created reply as a PullReviewComment.
 */
async function addReplyViaThreadGraphql(args: {
  token: string;
  owner: string;
  repo: string;
  pullNumber: number;
  reviewNodeId: string;
  reviewDatabaseId: number;
  inReplyToId: number;
  body: string;
}): Promise<PullReviewComment> {
  const threadId = await findReviewThreadNodeIdForComment(
    args.owner,
    args.repo,
    args.pullNumber,
    args.inReplyToId,
    args.token,
  );
  if (!threadId) {
    throw new GitHubApiError("Could not find the review thread for this comment.", 404);
  }

  const data = await githubGraphql<{
    addPullRequestReviewThreadReply: {
      comment: GraphqlReviewComment & {
        replyTo: { databaseId: number } | null;
      };
    };
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
  );

  const node = data.addPullRequestReviewThreadReply.comment;
  if (!node) {
    throw new Error("GitHub did not return the reply comment.");
  }
  return {
    id: node.databaseId,
    body: node.body,
    path: "",
    side: null,
    line: null,
    startLine: null,
    originalLine: null,
    inReplyToId: node.replyTo?.databaseId ?? args.inReplyToId,
    userLogin: node.author?.login ?? "",
    createdAt: node.createdAt,
    commitId: node.commit?.oid ?? "",
    htmlUrl: node.url,
    pullRequestReviewId: node.pullRequestReview?.databaseId ?? args.reviewDatabaseId,
  };
}

/**
 * GraphQL node IDs for a review comment, plus the anchor of the thread that
 * holds it. Anchor fields live on the thread, not on the comment.
 */
type ReviewCommentRef = {
  commentNodeId: string;
  threadNodeId: string;
  path: string;
  line: number | null;
  startLine: number | null;
  originalLine: number | null;
  diffSide: "LEFT" | "RIGHT" | null;
};

/**
 * Paginate through review threads to find the GraphQL node ID of the thread
 * that contains a specific comment (by database ID).
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param pullNumber - Pull request number.
 * @param commentDatabaseId - The numeric database ID of the target comment.
 * @param token - GitHub access token.
 * @returns The GraphQL node ID of the thread, or null if not found.
 */
async function findReviewThreadNodeIdForComment(
  owner: string,
  repo: string,
  pullNumber: number,
  commentDatabaseId: number,
  token: string,
): Promise<string | null> {
  const ref = await findReviewCommentRef(owner, repo, pullNumber, commentDatabaseId, token);
  return ref?.threadNodeId ?? null;
}

/**
 * Paginate through review threads to find the GraphQL node IDs for a comment.
 * Pending draft comments are only reachable this way, because REST hides them
 * until the review is submitted.
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param pullNumber - Pull request number.
 * @param commentDatabaseId - The numeric database ID of the target comment.
 * @param token - GitHub access token.
 * @returns The comment and thread node IDs, or null if not found.
 */
async function findReviewCommentRef(
  owner: string,
  repo: string,
  pullNumber: number,
  commentDatabaseId: number,
  token: string,
): Promise<ReviewCommentRef | null> {
  type ThreadLookup = {
    repository: {
      pullRequest: {
        reviewThreads: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          nodes: Array<{
            id: string;
            path: string;
            line: number | null;
            startLine: number | null;
            originalLine: number | null;
            diffSide: "LEFT" | "RIGHT" | null;
            comments: {
              nodes: Array<{ id: string; databaseId: number | null }>;
            };
          }>;
        };
      } | null;
    } | null;
  };

  let after: string | null = null;
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
                path
                line
                startLine
                originalLine
                diffSide
                comments(first: 50) {
                  nodes { id databaseId }
                }
              }
            }
          }
        }
      }`,
      { owner, repo, number: pullNumber, after },
    );

    const connection = data.repository?.pullRequest?.reviewThreads;
    if (!connection) return null;

    for (const thread of connection.nodes) {
      const match = thread.comments.nodes.find((c) => c.databaseId === commentDatabaseId);
      if (match) {
        return {
          commentNodeId: match.id,
          threadNodeId: thread.id,
          path: thread.path,
          line: thread.line,
          startLine: thread.startLine,
          originalLine: thread.originalLine,
          diffSide: thread.diffSide,
        };
      }
    }

    if (!connection.pageInfo.hasNextPage || !connection.pageInfo.endCursor) {
      break;
    }
    after = connection.pageInfo.endCursor;
  }
  return null;
}

export type UpdateReviewCommentInput = {
  owner: string;
  repo: string;
  /** Needed to look the comment up in GraphQL when REST cannot see it. */
  pullNumber: number;
  commentId: number;
  body: string;
};

/**
 * Update the body of an existing review comment.
 * Falls back to GraphQL for pending drafts, which REST answers with 404.
 * @param input - Owner, repo, pull number, comment ID, and the new body text.
 * @returns The updated PullReviewComment.
 */
export async function updateReviewComment(
  input: UpdateReviewCommentInput,
): Promise<PullReviewComment> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error("Connect to GitHub before editing a comment.");
  }
  try {
    const raw = await githubFetch<ApiComment>(
      `/repos/${input.owner}/${input.repo}/pulls/comments/${input.commentId}`,
      {
        token,
        method: "PATCH",
        body: { body: input.body },
      },
    );
    return normalizeComment(raw);
  } catch (error) {
    if (!isNotFound(error)) throw error;
    return updateViaGraphql(input, token);
  }
}

/**
 * Update a review comment through GraphQL, which can see pending drafts.
 * @param input - Owner, repo, pull number, comment ID, and the new body text.
 * @param token - GitHub access token.
 * @returns The updated PullReviewComment.
 */
async function updateViaGraphql(
  input: UpdateReviewCommentInput,
  token: string,
): Promise<PullReviewComment> {
  const ref = await findReviewCommentRef(
    input.owner,
    input.repo,
    input.pullNumber,
    input.commentId,
    token,
  );
  if (!ref) {
    throw new GitHubApiError("Could not find this review comment.", 404);
  }

  // Anchor fields (path, line, side) belong to the thread, not the comment.
  const data = await githubGraphql<{
    updatePullRequestReviewComment: {
      pullRequestReviewComment:
        | (GraphqlReviewComment & { replyTo: { databaseId: number } | null })
        | null;
    };
  }>(
    token,
    `mutation($pullRequestReviewCommentId: ID!, $body: String!) {
      updatePullRequestReviewComment(input: {
        pullRequestReviewCommentId: $pullRequestReviewCommentId
        body: $body
      }) {
        pullRequestReviewComment {
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
      pullRequestReviewCommentId: ref.commentNodeId,
      body: input.body,
    },
  );

  const node = data.updatePullRequestReviewComment.pullRequestReviewComment;
  if (!node) {
    throw new Error("GitHub did not return the updated comment.");
  }
  return {
    id: node.databaseId,
    body: node.body,
    path: ref.path,
    side: ref.diffSide,
    line: ref.line,
    startLine: ref.startLine,
    originalLine: ref.originalLine,
    inReplyToId: node.replyTo?.databaseId ?? null,
    userLogin: node.author?.login ?? "",
    createdAt: node.createdAt,
    commitId: node.commit?.oid ?? "",
    htmlUrl: node.url,
    pullRequestReviewId: node.pullRequestReview?.databaseId ?? null,
  };
}

export type DeleteReviewCommentInput = {
  owner: string;
  repo: string;
  /** Needed to look the comment up in GraphQL when REST cannot see it. */
  pullNumber: number;
  commentId: number;
};

/**
 * Delete a review comment by its ID.
 * Falls back to GraphQL for pending drafts, which REST answers with 404.
 * @param input - Owner, repo, pull number, and comment ID to delete.
 */
export async function deleteReviewComment(input: DeleteReviewCommentInput): Promise<void> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error("Connect to GitHub before deleting a comment.");
  }
  try {
    await githubFetch(`/repos/${input.owner}/${input.repo}/pulls/comments/${input.commentId}`, {
      token,
      method: "DELETE",
    });
  } catch (error) {
    if (!isNotFound(error)) throw error;
    await deleteViaGraphql(input, token);
  }
}

/**
 * Delete a review comment through GraphQL, which can see pending drafts.
 * @param input - Owner, repo, pull number, and comment ID to delete.
 * @param token - GitHub access token.
 * @returns Nothing.
 */
async function deleteViaGraphql(input: DeleteReviewCommentInput, token: string): Promise<void> {
  const ref = await findReviewCommentRef(
    input.owner,
    input.repo,
    input.pullNumber,
    input.commentId,
    token,
  );
  if (!ref) {
    throw new GitHubApiError("Could not find this review comment.", 404);
  }

  await githubGraphql(
    token,
    `mutation($id: ID!) {
      deletePullRequestReviewComment(input: { id: $id }) {
        clientMutationId
      }
    }`,
    { id: ref.commentNodeId },
  );
}

/**
 * Make sure the error is a GitHub 404, which is how REST reports a comment
 * it cannot see, including every comment in an unsubmitted review.
 * @param error - The caught error value.
 * @returns True when GitHub answered with 404.
 */
function isNotFound(error: unknown): boolean {
  return error instanceof GitHubApiError && error.status === 404;
}
