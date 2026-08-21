import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { alignMarkdown } from "../../markdown/align";
import {
  bindFileCollapseSync,
  bindHeaderControlSuppress,
  FILE_COLLAPSED_ATTR,
  findExpandAllLinesButton,
  findFileCollapseButton,
  findFileCommentButton,
  findViewedControl,
  hideInterferingHeaderControls,
  isFileCollapsed,
  showInterferingHeaderControls,
  syncFileCollapsedState,
} from "./headerControls";
import { ensureRichMounted, setRichModeFromTexts } from "./richStub";
import { hideRichView, showRichView } from "./richView";
import { createFileRegion, setFileCollapsed } from "./test/fixtures";
import { setRichPathIntent, clearRichPathIntents } from "./richIntent";
import { injectStyles, removeStyles } from "./styles";
import { clearSnapshotCache } from "./snapshotCache";

afterEach(() => {
  document.body.innerHTML = "";
  removeStyles();
  clearRichPathIntents();
});

describe("headerControls", () => {
  beforeEach(() => {
    clearSnapshotCache();
  });

  it("finds collapse via chevron icon, not Expand all lines", () => {
    const region = createFileRegion({
      path: "docs/PLAN.md",
      fileExpanded: true,
      includeExpandAllLines: true,
    });
    const collapse = findFileCollapseButton(region)!;
    expect(collapse.querySelector(".octicon-chevron-down")).not.toBeNull();
    expect(findExpandAllLinesButton(region)?.getAttribute("aria-label")).toContain(
      "Expand all lines",
    );
    expect(findFileCollapseButton(region)).not.toBe(findExpandAllLinesButton(region));
  });

  it("finds Viewed and file-comment controls", () => {
    const region = createFileRegion({
      path: "docs/PLAN.md",
      fileExpanded: true,
    });
    expect(findViewedControl(region)?.getAttribute("aria-label")).toBe("Not Viewed");
    expect(findFileCommentButton(region)?.getAttribute("aria-label")).toBe("Comment on this file");
  });

  it("finds Comment via octicon when aria-label is missing", () => {
    const region = createFileRegion({ path: "docs/PLAN.md" });
    const comment = findFileCommentButton(region)!;
    comment.removeAttribute("aria-label");
    comment.replaceChildren();
    const icon = document.createElement("svg");
    icon.classList.add("octicon-comment");
    comment.appendChild(icon);

    expect(findFileCommentButton(region)).toBe(comment);
  });

  it("hides Viewed and Comment but keeps the collapse chevron", () => {
    const region = createFileRegion({
      path: "README.md",
      fileExpanded: true,
      includeExpandAllLines: true,
    });
    document.body.appendChild(region);
    region.setAttribute("data-rgm-mode", "rich");

    const rows = alignMarkdown("A\n", "B\n");
    showRichView(region, rows, { baseText: "A\n", headText: "B\n" });

    const collapse = findFileCollapseButton(region)!;
    const viewed = findViewedControl(region)!;
    const comment = findFileCommentButton(region)!;
    const expandAll = findExpandAllLinesButton(region)!;

    expect(collapse.hasAttribute("data-rgm-rich-suppressed")).toBe(false);
    expect(collapse.hasAttribute("hidden")).toBe(false);
    expect(viewed.hasAttribute("data-rgm-rich-suppressed")).toBe(true);
    expect(comment.hasAttribute("data-rgm-rich-suppressed")).toBe(true);
    expect(expandAll.hasAttribute("data-rgm-rich-suppressed")).toBe(true);

    region.removeAttribute("data-rgm-mode");
    hideRichView(region);

    expect(viewed.hasAttribute("data-rgm-rich-suppressed")).toBe(false);
    expect(comment.hasAttribute("data-rgm-rich-suppressed")).toBe(false);
  });

  it("re-hides Comment when GitHub re-renders it into the header", () => {
    const region = createFileRegion({
      path: "README.md",
      fileExpanded: true,
    });
    document.body.appendChild(region);
    region.setAttribute("data-rgm-mode", "rich");
    const rows = alignMarkdown("A\n", "A\n");
    showRichView(region, rows, { baseText: "A\n", headText: "A\n" });
    bindHeaderControlSuppress(region);

    const actions = region.querySelector(".d-flex.flex-items-center.gap-2")!;
    region.querySelector('button[aria-label="Comment on this file"]')?.remove();
    const fresh = document.createElement("button");
    fresh.type = "button";
    fresh.setAttribute("aria-label", "Comment on this file");
    const icon = document.createElement("svg");
    icon.classList.add("octicon-comment");
    fresh.appendChild(icon);
    actions.appendChild(fresh);

    hideInterferingHeaderControls(region);
    expect(fresh.hasAttribute("data-rgm-rich-suppressed")).toBe(true);
  });

  it("hide/show is idempotent", () => {
    const region = createFileRegion({
      path: "README.md",
      fileExpanded: true,
    });
    hideInterferingHeaderControls(region);
    hideInterferingHeaderControls(region);
    expect(findFileCommentButton(region)?.hasAttribute("data-rgm-rich-suppressed")).toBe(true);
    showInterferingHeaderControls(region);
    showInterferingHeaderControls(region);
    expect(findFileCommentButton(region)?.hasAttribute("data-rgm-rich-suppressed")).toBe(false);
  });
});

describe("file collapse sync", () => {
  it("detects collapsed state from DiffFileHeader class and chevron", () => {
    const region = createFileRegion({
      path: "docs/PLAN.md",
      fileExpanded: true,
    });
    expect(isFileCollapsed(region)).toBe(false);

    setFileCollapsed(region, true);
    expect(isFileCollapsed(region)).toBe(true);

    setFileCollapsed(region, false);
    // Restore a body so the fixture is expanded again.
    const body = document.createElement("div");
    body.className = "border position-relative rounded-bottom-2";
    const table = document.createElement("table");
    table.setAttribute("aria-label", "Diff for: docs/PLAN.md");
    body.appendChild(table);
    region.appendChild(body);
    expect(isFileCollapsed(region)).toBe(false);
  });

  it("hides the rich view when the file section collapses", () => {
    injectStyles();
    const region = createFileRegion({
      path: "docs/PLAN.md",
      fileExpanded: true,
    });
    document.body.appendChild(region);
    setRichModeFromTexts(region, "# A\n", "# B\n");

    expect(region.hasAttribute(FILE_COLLAPSED_ATTR)).toBe(false);
    expect(document.getElementById("rgm-markdown-review-styles")?.textContent).toContain(
      "[data-rgm-file-collapsed] [data-rgm-rich]",
    );

    setFileCollapsed(region, true);
    syncFileCollapsedState(region);

    expect(region.hasAttribute(FILE_COLLAPSED_ATTR)).toBe(true);
    // Rich root stays mounted so expand can restore instantly.
    expect(region.querySelector("[data-rgm-rich]")).not.toBeNull();
  });

  it("mirrors collapse via MutationObserver on header class changes", async () => {
    const region = createFileRegion({
      path: "docs/PLAN.md",
      fileExpanded: true,
    });
    document.body.appendChild(region);
    setRichModeFromTexts(region, "A\n", "B\n");
    bindFileCollapseSync(region);

    expect(region.hasAttribute(FILE_COLLAPSED_ATTR)).toBe(false);

    const fileHeader = region.querySelector('[class*="DiffFileHeader-module__diff-file-header"]')!;
    fileHeader.classList.add("DiffFileHeader-module__collapsed__ZY5uc");
    const icon = region.querySelector("svg.octicon-chevron-down")!;
    icon.classList.replace("octicon-chevron-down", "octicon-chevron-right");

    await vi.waitFor(() => {
      expect(region.hasAttribute(FILE_COLLAPSED_ATTR)).toBe(true);
    });
  });

  it("re-hides a remounted native diff body while rich intent stays on", () => {
    const region = createFileRegion({
      path: "docs/PLAN.md",
      fileExpanded: true,
    });
    document.body.appendChild(region);
    setRichPathIntent("docs/PLAN.md", true);
    setRichModeFromTexts(region, "A\n", "B\n");

    // Simulate GitHub destroying the old body and mounting a fresh one.
    region.querySelector("[data-rgm-diff-hidden]")?.remove();
    const fresh = document.createElement("div");
    fresh.className = "border position-relative rounded-bottom-2";
    const table = document.createElement("table");
    table.setAttribute("aria-label", "Diff for: docs/PLAN.md");
    fresh.appendChild(table);
    region.appendChild(fresh);

    ensureRichMounted(region);

    expect(fresh.hasAttribute("data-rgm-diff-hidden")).toBe(true);
    expect(region.querySelector("[data-rgm-rich]")).not.toBeNull();
  });
});
