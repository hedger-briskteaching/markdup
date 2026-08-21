import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./auth", () => ({
  getAccessToken: async () => "tok",
  getStoredLogin: async () => "me",
}));

const { deleteReviewComment, updateReviewComment } = await import("./pulls");

type GraphqlBody = {
  query?: string;
  variables?: Record<string, unknown>;
};

/**
 * Route REST and GraphQL requests to canned responses and record the order
 * they were called in, so the fallback path can be asserted.
 */
function stubGitHub(options: { restStatus: number; threadNodes?: unknown[] }): { calls: string[] } {
  const calls: string[] = [];
  const nodes = options.threadNodes ?? [
    {
      id: "THREAD_1",
      path: "README.md",
      line: 5,
      startLine: null,
      originalLine: null,
      diffSide: "RIGHT",
      comments: { nodes: [{ id: "PRRC_10", databaseId: 10 }] },
    },
  ];

  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const body = init?.body ? (JSON.parse(String(init.body)) as GraphqlBody) : {};

    if (url.includes("/pulls/comments/")) {
      calls.push(`REST ${method}`);
      if (options.restStatus >= 400) {
        return Response.json(
          { message: options.restStatus === 404 ? "Not Found" : "Forbidden" },
          { status: options.restStatus },
        );
      }
      return Response.json({
        id: 10,
        body: "From REST",
        path: "README.md",
        side: "RIGHT",
        line: 5,
        created_at: "2026-01-01T00:00:00Z",
        commit_id: "sha",
        html_url: "https://example.com",
      });
    }

    const query = body.query ?? "";
    const variables = body.variables ?? {};

    if (query.includes("reviewThreads")) {
      calls.push("GRAPHQL lookup");
      return Response.json({
        data: {
          repository: {
            pullRequest: {
              reviewThreads: {
                pageInfo: { hasNextPage: false, endCursor: null },
                nodes,
              },
            },
          },
        },
      });
    }

    if (query.includes("updatePullRequestReviewComment")) {
      calls.push("GRAPHQL update");
      expect(variables.pullRequestReviewCommentId).toBe("PRRC_10");
      // Anchor fields do not exist on PullRequestReviewComment.
      expect(query).not.toContain("diffSide");
      return Response.json({
        data: {
          updatePullRequestReviewComment: {
            pullRequestReviewComment: {
              databaseId: 10,
              body: variables.body,
              url: "https://example.com",
              createdAt: "2026-01-01T00:00:00Z",
              commit: { oid: "sha" },
              author: { login: "me" },
              pullRequestReview: { databaseId: 7 },
              replyTo: null,
            },
          },
        },
      });
    }

    if (query.includes("deletePullRequestReviewComment")) {
      calls.push("GRAPHQL delete");
      expect(variables.id).toBe("PRRC_10");
      return Response.json({
        data: { deletePullRequestReviewComment: { clientMutationId: null } },
      });
    }

    throw new Error(`unexpected request ${method} ${url}`);
  });

  vi.stubGlobal("fetch", fetchMock);
  return { calls };
}

const target = { owner: "o", repo: "r", pullNumber: 1, commentId: 10 };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("updateReviewComment", () => {
  it("edits a pending draft through GraphQL after REST reports 404", async () => {
    const { calls } = stubGitHub({ restStatus: 404 });

    const updated = await updateReviewComment({ ...target, body: "Edited" });

    expect(updated.body).toBe("Edited");
    // Anchor carried over from the thread the comment belongs to.
    expect(updated.side).toBe("RIGHT");
    expect(updated.path).toBe("README.md");
    expect(updated.line).toBe(5);
    expect(calls).toEqual(["REST PATCH", "GRAPHQL lookup", "GRAPHQL update"]);
  });

  it("stays on REST for a comment in a submitted review", async () => {
    const { calls } = stubGitHub({ restStatus: 200 });

    const updated = await updateReviewComment({ ...target, body: "Edited" });

    expect(updated.body).toBe("From REST");
    expect(calls).toEqual(["REST PATCH"]);
  });

  it("reports failures other than 404 instead of falling back", async () => {
    const { calls } = stubGitHub({ restStatus: 403 });

    await expect(updateReviewComment({ ...target, body: "Edited" })).rejects.toThrow("Forbidden");
    expect(calls).toEqual(["REST PATCH"]);
  });

  it("reports a comment it cannot find in any thread", async () => {
    const { calls } = stubGitHub({ restStatus: 404, threadNodes: [] });

    await expect(updateReviewComment({ ...target, body: "Edited" })).rejects.toThrow(
      "Could not find this review comment.",
    );
    expect(calls).toEqual(["REST PATCH", "GRAPHQL lookup"]);
  });
});

describe("deleteReviewComment", () => {
  it("deletes a pending draft through GraphQL after REST reports 404", async () => {
    const { calls } = stubGitHub({ restStatus: 404 });

    await deleteReviewComment(target);

    expect(calls).toEqual(["REST DELETE", "GRAPHQL lookup", "GRAPHQL delete"]);
  });

  it("stays on REST for a comment in a submitted review", async () => {
    const { calls } = stubGitHub({ restStatus: 200 });

    await deleteReviewComment(target);

    expect(calls).toEqual(["REST DELETE"]);
  });
});
