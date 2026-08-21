import { describe, expect, it } from "vitest";
import { createPayloadFromRange } from "../../shared/reviewComment";
import { formatGitHubErrorMessage, GitHubApiError } from "./client";
import {
  buildThreads,
  isPendingReviewConflict,
  threadFromGraphqlNode,
  type PullReviewComment,
} from "./pulls";
import {
  clampRangeToDiff,
  parseCommentableLines,
  snapToCommentableRange,
} from "../../shared/commentableLines";

function comment(
  partial: Partial<PullReviewComment> & Pick<PullReviewComment, "id" | "body">,
): PullReviewComment {
  return {
    path: "docs/PLAN.md",
    side: "RIGHT",
    line: 10,
    startLine: null,
    originalLine: null,
    inReplyToId: null,
    userLogin: "alice",
    createdAt: "2026-01-01T00:00:00Z",
    commitId: "abc",
    htmlUrl: "https://github.com/o/r/pull/1#discussion_r1",
    pullRequestReviewId: null,
    ...partial,
  };
}

describe("buildThreads", () => {
  it("groups replies under the root comment", () => {
    const threads = buildThreads([
      comment({ id: 1, body: "root", line: 4, startLine: 2 }),
      comment({
        id: 2,
        body: "reply",
        inReplyToId: 1,
        createdAt: "2026-01-01T01:00:00Z",
      }),
      comment({ id: 3, body: "other", line: 20, path: "docs/PLAN.md" }),
    ]);

    expect(threads).toHaveLength(2);
    expect(threads[0]).toMatchObject({
      rootId: 1,
      startLine: 2,
      line: 4,
      side: "RIGHT",
    });
    expect(threads[0]!.comments.map((c) => c.id)).toEqual([1, 2]);
    expect(threads[1]!.rootId).toBe(3);
    expect(threads[0]!.pending).toBe(false);
  });

  it("marks threads from a pending review", () => {
    const threads = buildThreads(
      [
        comment({
          id: 1,
          body: "draft",
          line: 4,
          pullRequestReviewId: 99,
        }),
      ],
      new Set([99]),
    );
    expect(threads).toHaveLength(1);
    expect(threads[0]!.pending).toBe(true);
  });

  it("skips comments without a side or line", () => {
    const threads = buildThreads([
      comment({ id: 1, body: "x", side: null, line: null }),
      comment({ id: 2, body: "y", line: 3 }),
    ]);
    expect(threads).toHaveLength(1);
    expect(threads[0]!.rootId).toBe(2);
  });
});

describe("threadFromGraphqlNode", () => {
  it("keeps pending GraphQL threads that REST would strip (null line/side)", () => {
    const thread = threadFromGraphqlNode({
      path: "docs/PLAN.md",
      line: 1237,
      startLine: 1237,
      originalLine: 1237,
      diffSide: "RIGHT",
      comments: {
        nodes: [
          {
            databaseId: 99,
            body: "ok",
            createdAt: "2026-01-01T00:00:00Z",
            url: "https://example.com",
            author: { login: "alice" },
            commit: { oid: "abc" },
            pullRequestReview: { databaseId: 7, state: "PENDING" },
            replyTo: null,
          },
        ],
      },
    });
    expect(thread).toMatchObject({
      rootId: 99,
      path: "docs/PLAN.md",
      side: "RIGHT",
      startLine: 1237,
      line: 1237,
      pending: true,
    });
    expect(thread?.comments[0]?.body).toBe("ok");
  });

  it("returns null when the thread has no resolvable line", () => {
    expect(
      threadFromGraphqlNode({
        path: "docs/PLAN.md",
        line: null,
        startLine: null,
        originalLine: null,
        diffSide: "RIGHT",
        comments: { nodes: [] },
      }),
    ).toBeNull();
  });
});

describe("createPayloadFromRange", () => {
  it("omits start_line for a single-line range", () => {
    expect(
      createPayloadFromRange({
        body: "nit",
        path: "a.md",
        commitId: "sha",
        side: "RIGHT",
        startLine: 5,
        endLine: 5,
      }),
    ).toEqual({
      path: "a.md",
      body: "nit",
      commitId: "sha",
      side: "RIGHT",
      line: 5,
    });
  });

  it("includes start_line for a multi-line range", () => {
    expect(
      createPayloadFromRange({
        body: "please expand",
        path: "a.md",
        commitId: "sha",
        side: "LEFT",
        startLine: 3,
        endLine: 7,
      }),
    ).toEqual({
      path: "a.md",
      body: "please expand",
      commitId: "sha",
      side: "LEFT",
      line: 7,
      startLine: 3,
      startSide: "LEFT",
    });
  });
});

describe("parseCommentableLines", () => {
  it("collects left/right lines from a unified patch", () => {
    const patch = ["@@ -10,4 +12,5 @@", " context", "-deleted", "+added", "+added2", " more"].join(
      "\n",
    );
    const lines = parseCommentableLines(patch);
    expect([...lines.left].sort((a, b) => a - b)).toEqual([10, 11, 12]);
    expect([...lines.right].sort((a, b) => a - b)).toEqual([12, 13, 14, 15]);
  });
});

describe("clampRangeToDiff", () => {
  it("returns null when the selection misses the diff", () => {
    expect(
      clampRangeToDiff("RIGHT", 1, 3, {
        left: new Set(),
        right: new Set([10, 11]),
      }),
    ).toBeNull();
  });

  it("keeps only the overlapping commentable span", () => {
    expect(
      clampRangeToDiff("RIGHT", 8, 14, {
        left: new Set(),
        right: new Set([10, 11, 12]),
      }),
    ).toEqual({ start: 10, end: 12 });
  });

  it("picks the longest contiguous commentable run", () => {
    expect(
      clampRangeToDiff("RIGHT", 8, 20, {
        left: new Set(),
        right: new Set([9, 10, 14, 15, 16, 17]),
      }),
    ).toEqual({ start: 14, end: 17 });
  });

  it("passes the range through when the patch is unknown", () => {
    expect(clampRangeToDiff("LEFT", 4, 6, { left: new Set(), right: new Set() })).toEqual({
      start: 4,
      end: 6,
    });
  });
});

describe("snapToCommentableRange", () => {
  it("keeps only the overlapping commentable span", () => {
    expect(
      snapToCommentableRange("RIGHT", 8, 14, {
        left: new Set(),
        right: new Set([10, 11, 12]),
      }),
    ).toEqual({ start: 10, end: 12 });
  });

  it("falls back to the nearest commentable run outside the selection", () => {
    expect(
      snapToCommentableRange(
        "RIGHT",
        20,
        20,
        { left: new Set(), right: new Set([13, 14, 15]) },
        { srcFrom: 13, srcTo: 20 },
      ),
    ).toEqual({ start: 13, end: 15 });
  });
});

describe("formatGitHubErrorMessage", () => {
  it("joins field validation details", () => {
    expect(
      formatGitHubErrorMessage(422, {
        message: "Validation Failed",
        errors: [
          {
            message: "pull_request_review_thread.line must be part of the diff",
          },
        ],
      }),
    ).toContain("must be part of the diff");
  });
});

describe("isPendingReviewConflict", () => {
  it("detects the one-pending-review validation error", () => {
    expect(
      isPendingReviewConflict(
        new GitHubApiError("user_id can only have one pending review per pull request", 422),
      ),
    ).toBe(true);
    expect(isPendingReviewConflict(new Error("nope"))).toBe(false);
  });
});
