/** Pattern that matches GitHub PR Files changed paths (classic and new). */
const PR_FILES_PATH = /^\/[^/]+\/[^/]+\/pull\/\d+\/(?:files|changes)(?:\/.*)?$/;

/** Bidirectional marks GitHub wraps around file paths in the header. */
const BIDI_MARKS = /[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;

/**
 * Remove bidirectional marks and whitespace from a raw file path string.
 * @param raw - The raw path text from GitHub DOM.
 * @returns Cleaned path without bidi marks or surrounding whitespace.
 */
export function cleanFilePath(raw: string): string {
  return raw.replace(BIDI_MARKS, "").trim();
}

/**
 * Determine if the current page is a GitHub PR "Files changed" view.
 * @param pathname - URL pathname to test. Defaults to current location.
 * @returns True when the pathname matches a PR files or changes route.
 */
export function isPrFilesPage(pathname = location.pathname): boolean {
  return PR_FILES_PATH.test(pathname);
}

/**
 * Determine if a file path ends with a markdown extension.
 * @param path - File path string to test.
 * @returns True when the path ends with .md or .markdown.
 */
export function isMarkdownPath(path: string): boolean {
  const lower = cleanFilePath(path).toLowerCase();
  return lower.endsWith(".md") || lower.endsWith(".markdown");
}

/**
 * Extract the file path from a diff region element.
 * Prefer data-file-path attribute. Fall back to header link text.
 * @param region - The file region DOM element.
 * @returns The cleaned file path, or null if not found.
 */
export function getFilePath(region: Element): string | null {
  const pathButton = region.querySelector<HTMLElement>("button[data-file-path]");
  const fromAttr = pathButton?.getAttribute("data-file-path");
  if (fromAttr) {
    const cleaned = cleanFilePath(fromAttr);
    if (cleaned) {
      return cleaned;
    }
  }

  const link = region.querySelector<HTMLAnchorElement>("[data-diff-header-wrapper] h3 a");
  const fromLink = link?.textContent;
  if (fromLink) {
    const cleaned = cleanFilePath(fromLink);
    if (cleaned) {
      return cleaned;
    }
  }

  return null;
}
