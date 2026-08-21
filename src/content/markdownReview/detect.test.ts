import { describe, expect, it } from "vitest";
import { cleanFilePath, getFilePath, isMarkdownPath, isPrFilesPage } from "./detect";
import { createFileRegion } from "./test/fixtures";

describe("isPrFilesPage", () => {
  it("matches new /changes and classic /files URLs", () => {
    expect(isPrFilesPage("/owner/repo/pull/42/changes")).toBe(true);
    expect(isPrFilesPage("/owner/repo/pull/42/files")).toBe(true);
    expect(isPrFilesPage("/owner/repo/pull/42/files/abc123")).toBe(true);
  });

  it("rejects conversation and other pages", () => {
    expect(isPrFilesPage("/owner/repo/pull/42")).toBe(false);
    expect(isPrFilesPage("/owner/repo/pull/42/commits")).toBe(false);
    expect(isPrFilesPage("/owner/repo")).toBe(false);
    expect(isPrFilesPage("/")).toBe(false);
  });
});

describe("cleanFilePath", () => {
  it("strips GitHub bidi marks around paths", () => {
    expect(cleanFilePath("\u200edocs/README.md\u200e")).toBe("docs/README.md");
    expect(cleanFilePath("  docs/PLAN.md  ")).toBe("docs/PLAN.md");
  });
});

describe("isMarkdownPath", () => {
  it("accepts .md and .markdown case-insensitively", () => {
    expect(isMarkdownPath("docs/PLAN.md")).toBe(true);
    expect(isMarkdownPath("README.MD")).toBe(true);
    expect(isMarkdownPath("notes.markdown")).toBe(true);
    expect(isMarkdownPath("notes.MARKDOWN")).toBe(true);
  });

  it("accepts paths wrapped in GitHub bidi marks", () => {
    expect(isMarkdownPath("\u200edocs/README.md\u200e")).toBe(true);
  });

  it("rejects non-markdown paths", () => {
    expect(isMarkdownPath("src/main.ts")).toBe(false);
    expect(isMarkdownPath("file.mdx")).toBe(false);
    expect(isMarkdownPath("readme.md.bak")).toBe(false);
  });
});

describe("getFilePath", () => {
  it("prefers data-file-path on the path button", () => {
    const region = createFileRegion({ path: "docs/PLAN.md" });
    expect(getFilePath(region)).toBe("docs/PLAN.md");
  });

  it("falls back to header link text", () => {
    const region = createFileRegion({
      path: "docs/README.md",
      pathViaLinkOnly: true,
    });
    expect(getFilePath(region)).toBe("docs/README.md");
  });

  it("strips bidi marks from header link text", () => {
    const region = createFileRegion({
      path: "docs/README.md",
      pathViaLinkOnly: true,
    });
    const link = region.querySelector("h3 a")!;
    link.textContent = "\u200edocs/README.md\u200e";
    expect(getFilePath(region)).toBe("docs/README.md");
  });

  it("returns null when path cannot be found", () => {
    const region = document.createElement("div");
    expect(getFilePath(region)).toBeNull();
  });
});
