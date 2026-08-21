import { afterEach, describe, expect, it } from "vitest";
import { alignMarkdown } from "../../markdown/align";
import type { ReviewThreadDto } from "../../shared/messages";
import { renderRowsForTest } from "./richView";
import { applyServerThreads } from "./syncThreads";

const baseText = "# Same heading\n\nOld paragraph.\n\nShared tail text.\n";
const headText = "# Same heading\n\nNew paragraph.\n\nShared tail text.\n";

function mount(startCollapsed: boolean): HTMLElement {
  const rows = alignMarkdown(baseText, headText);
  const host = renderRowsForTest(rows, {
    baseText,
    headText,
    path: "docs/PLAN.md",
    startCollapsed,
  });
  document.body.appendChild(host);
  return host;
}

function tailThread(): ReviewThreadDto {
  return {
    rootId: 11,
    path: "docs/PLAN.md",
    side: "RIGHT",
    startLine: 5,
    line: 5,
    pending: true,
    comments: [
      {
        id: 11,
        body: "Note on the tail.",
        path: "docs/PLAN.md",
        side: "RIGHT",
        line: 5,
        startLine: 5,
        originalLine: null,
        inReplyToId: null,
        userLogin: "hedger",
        createdAt: "2026-08-04T00:00:00Z",
        commitId: "sha",
        htmlUrl: "https://example.com",
        pullRequestReviewId: 7,
      },
    ],
  };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("collapsed unchanged sections", () => {
  it("hides unchanged rows behind fold bars by default", () => {
    const host = mount(true);

    expect(host.textContent).toContain("New paragraph.");
    expect(host.textContent).not.toContain("Same heading");
    expect(host.textContent).not.toContain("Shared tail text.");

    const toggles = host.querySelectorAll("[data-rgm-fold-toggle]");
    expect(toggles).toHaveLength(2);
    expect(toggles[0]?.textContent).toContain("1 unchanged block");
    expect(toggles[0]?.getAttribute("aria-expanded")).toBe("false");
  });

  it("expands and collapses a section via the fold button", () => {
    const host = mount(true);

    const toggle = host.querySelector<HTMLButtonElement>("[data-rgm-fold-toggle]")!;
    toggle.click();

    expect(host.textContent).toContain("Same heading");
    const expandedToggle = host.querySelector<HTMLButtonElement>("[data-rgm-fold-toggle]")!;
    expect(expandedToggle.getAttribute("aria-expanded")).toBe("true");
    expect(expandedToggle.textContent).toContain("−");

    expandedToggle.click();
    expect(host.textContent).not.toContain("Same heading");
    expect(host.querySelector("[data-rgm-fold-toggle]")?.getAttribute("aria-expanded")).toBe(
      "false",
    );
  });

  it("renders expanded in tests unless startCollapsed is set", () => {
    const host = mount(false);
    expect(host.textContent).toContain("Same heading");
    expect(host.textContent).toContain("Shared tail text.");
  });

  it("auto-expands the section owning a synced thread", () => {
    const host = mount(true);
    expect(host.textContent).not.toContain("Shared tail text.");

    applyServerThreads(host, [tailThread()]);

    expect(host.textContent).toContain("Shared tail text.");
    const card = host.querySelector("[data-rgm-thread-card]");
    expect(card).not.toBeNull();
    expect(card?.textContent).toContain("Note on the tail.");
  });
});
