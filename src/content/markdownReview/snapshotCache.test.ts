import { beforeEach, describe, expect, it, vi } from "vitest";
import { setRichMode } from "./richStub";
import { clearSnapshotCache } from "./snapshotCache";
import { createFileRegion } from "./test/fixtures";

const SNAPSHOT = {
  owner: "o",
  repo: "r",
  pullNumber: 1,
  path: "docs/PLAN.md",
  baseText: "# Title\n\nOld text.\n",
  headText: "# Title\n\nNew text.\n",
  baseSha: "aaa",
  headSha: "bbb",
  commentable: { left: [], right: [] },
};

/** Count background calls by message type. */
function countsOf(sendMessage: ReturnType<typeof vi.fn>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const call of sendMessage.mock.calls) {
    const type = call[0]?.type;
    if (type) counts[type] = (counts[type] ?? 0) + 1;
  }
  return counts;
}

/** Mount a fresh file region in rich mode and wait for the view to appear. */
async function mount(): Promise<HTMLElement> {
  const region = createFileRegion({ path: "docs/PLAN.md" });
  document.body.appendChild(region);
  setRichMode(region, true);
  await vi.waitFor(() => {
    expect(region.querySelector("[data-rgm-rich] .rgm-rich-body")).not.toBeNull();
  });
  return region;
}

describe("rich view mount caching", () => {
  let sendMessage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clearSnapshotCache();
    document.body.innerHTML = "";
    history.replaceState({}, "", "/o/r/pull/1/files");
    sendMessage = vi.fn().mockImplementation(async (m: { type: string }) => {
      if (m.type === "FETCH_FILE_SNAPSHOT") return SNAPSHOT;
      if (m.type === "AUTH_STATUS") return { authenticated: true, login: "hedger" };
      if (m.type === "FETCH_THREAD_INDEX") return { threads: [] };
      return { error: `unexpected ${m.type}` };
    });
    vi.stubGlobal("chrome", { runtime: { sendMessage } });
  });

  it("fetches the snapshot on the first mount", async () => {
    await mount();
    expect(countsOf(sendMessage).FETCH_FILE_SNAPSHOT).toBe(1);
  });

  it("remounts the same file without refetching it", async () => {
    await mount();
    const first = countsOf(sendMessage);

    // GitHub re-rendering the page destroys the view; it must come back free.
    document.body.innerHTML = "";
    await mount();
    const second = countsOf(sendMessage);

    expect(second.FETCH_FILE_SNAPSHOT).toBe(first.FETCH_FILE_SNAPSHOT);
    expect(second.AUTH_STATUS).toBe(first.AUTH_STATUS);
  });

  it("renders the cached remount without a loading state", async () => {
    await mount();
    document.body.innerHTML = "";

    const region = createFileRegion({ path: "docs/PLAN.md" });
    document.body.appendChild(region);
    setRichMode(region, true);

    // Cached mount still renders, and never shows the spinner on the way.
    expect(region.textContent).not.toContain("Loading");
    await vi.waitFor(() => {
      expect(region.querySelector("[data-rgm-rich]")?.textContent).toContain("New text.");
    });
  });

  it("still fetches a file it has not seen before", async () => {
    await mount();
    const before = countsOf(sendMessage).FETCH_FILE_SNAPSHOT;

    document.body.innerHTML = "";
    const other = createFileRegion({ path: "docs/OTHER.md" });
    document.body.appendChild(other);
    setRichMode(other, true);

    await vi.waitFor(() => {
      expect(countsOf(sendMessage).FETCH_FILE_SNAPSHOT).toBe(before + 1);
    });
  });
});
