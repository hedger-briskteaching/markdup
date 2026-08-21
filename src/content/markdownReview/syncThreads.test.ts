import { beforeEach, describe, expect, it, vi } from "vitest";
import { alignMarkdown } from "../../markdown/align";
import { renderRowsForTest } from "./richView";
import { getRichViewContext, setRichViewContext } from "./selection";
import { syncThreadsFromServer } from "./syncThreads";

describe("syncThreadsFromServer", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  it("replaces local threads with the server index", async () => {
    const sendMessage = vi.fn().mockResolvedValue({
      owner: "o",
      repo: "r",
      pullNumber: 1,
      path: "a.md",
      threads: [
        {
          rootId: 5,
          path: "a.md",
          side: "RIGHT",
          startLine: 1,
          line: 1,
          pending: true,
          comments: [
            {
              id: 5,
              body: "From GitHub",
              path: "a.md",
              side: "RIGHT",
              line: 1,
              startLine: null,
              originalLine: null,
              inReplyToId: null,
              userLogin: "alice",
              createdAt: "2026-01-01T00:00:00Z",
              commitId: "sha",
              htmlUrl: "https://example.com",
            },
          ],
        },
      ],
    });
    vi.stubGlobal("chrome", { runtime: { sendMessage } });

    const text = "Hello world.\n";
    const rows = alignMarkdown(text, text);
    const host = renderRowsForTest(rows, {
      baseText: text,
      headText: text,
      owner: "o",
      repo: "r",
      pullNumber: 1,
      path: "a.md",
    });
    document.body.appendChild(host);
    setRichViewContext(host, {
      ...getRichViewContext(host)!,
      threads: [
        {
          rootId: 1,
          path: "a.md",
          side: "RIGHT",
          startLine: 1,
          line: 1,
          pending: false,
          comments: [],
        },
      ],
    });

    const result = await syncThreadsFromServer(host, {
      owner: "o",
      repo: "r",
      pullNumber: 1,
      path: "a.md",
    });

    expect(result.ok).toBe(true);
    expect(getRichViewContext(host)?.threads).toHaveLength(1);
    expect(getRichViewContext(host)?.threads?.[0]?.rootId).toBe(5);
    expect(host.textContent).toContain("From GitHub");
    expect(host.textContent).not.toContain("stale");
  });

  it("retries until the expected comment id appears", async () => {
    const sendMessage = vi
      .fn()
      .mockResolvedValueOnce({
        owner: "o",
        repo: "r",
        pullNumber: 1,
        path: "a.md",
        threads: [],
      })
      .mockResolvedValueOnce({
        owner: "o",
        repo: "r",
        pullNumber: 1,
        path: "a.md",
        threads: [
          {
            rootId: 42,
            path: "a.md",
            side: "RIGHT",
            startLine: 1,
            line: 1,
            pending: true,
            comments: [
              {
                id: 42,
                body: "Ready",
                path: "a.md",
                side: "RIGHT",
                line: 1,
                startLine: null,
                originalLine: null,
                inReplyToId: null,
                userLogin: "bob",
                createdAt: "2026-01-01T00:00:00Z",
                commitId: "sha",
                htmlUrl: "https://example.com",
              },
            ],
          },
        ],
      });
    vi.stubGlobal("chrome", { runtime: { sendMessage } });

    const text = "Hello world.\n";
    const rows = alignMarkdown(text, text);
    const host = renderRowsForTest(rows, {
      baseText: text,
      headText: text,
      owner: "o",
      repo: "r",
      pullNumber: 1,
      path: "a.md",
    });
    document.body.appendChild(host);

    const result = await syncThreadsFromServer(
      host,
      { owner: "o", repo: "r", pullNumber: 1, path: "a.md" },
      { expectCommentId: 42, attempts: 3, delayMs: 1 },
    );

    expect(result.ok).toBe(true);
    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain("Ready");
  });
});
