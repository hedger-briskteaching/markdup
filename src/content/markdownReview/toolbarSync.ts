/**
 * Refresh the counters in GitHub's Files toolbar after a comment change.
 *
 * GitHub renders that toolbar from React state hydrated once at page load, and
 * it never learns about comments Markdup creates through the API. Re-mounting
 * the app would fix it but re-renders every diff, and reloading costs scroll
 * and focus.
 *
 * So take the narrowest possible action: fetch the page GitHub would serve
 * right now, find the same toolbar in it, and copy across the text that
 * differs. Only text nodes are written, never elements, so React keeps every
 * DOM node it holds a reference to and cannot be broken by the edit.
 *
 * Known limits, by design:
 * - React's own state stays stale, so it can overwrite this on a re-render.
 * - Only this toolbar is corrected. Anything else GitHub renders from the
 *   same stale state, such as native inline threads, stays as it was.
 */

/** Divider inside the toolbar. The only stable test id GitHub gives it. */
const TOOLBAR_ANCHOR = '[data-testid="file-controls-divider"]';

/**
 * Class prefix fallback. The suffix is a CSS-module hash that changes between
 * GitHub deploys, so only match on the stable prefix.
 */
const TOOLBAR_CLASS_HINT = '[class*="PullRequestFilesToolbar-module__"]';

const TOOLBAR_ROOT = '[data-component="Stack"]';

/** Wait before retrying, for when GitHub's HTML has not caught up yet. */
const RETRY_DELAY_MS = 700;

let inFlight = false;

/**
 * Find the Files toolbar in a live document or a parsed one.
 * @param root - Document or element to search.
 * @returns The toolbar element, or null when the markup has moved on.
 */
export function findFilesToolbar(root: Document | Element): HTMLElement | null {
  const anchored = root.querySelector(TOOLBAR_ANCHOR)?.closest(TOOLBAR_ROOT);
  if (anchored instanceof HTMLElement) return anchored;

  const hinted = root.querySelector(TOOLBAR_CLASS_HINT)?.closest(TOOLBAR_ROOT);
  return hinted instanceof HTMLElement ? hinted : null;
}

/**
 * Copy differing text from a freshly served toolbar onto the live one.
 * Children are matched by shape rather than position, so an inserted or
 * removed control does not shift everything after it onto the wrong node.
 * @param live - The toolbar element on the page.
 * @param fresh - The same toolbar from freshly fetched HTML.
 * @returns How many text nodes were rewritten.
 */
export function copyToolbarText(live: Element, fresh: Element): number {
  let written = 0;

  const liveText = textChildren(live);
  const freshText = textChildren(fresh);
  // Differing counts mean the shape changed, and pairing them up would write
  // the wrong values. Leave this level alone and let the children be matched.
  if (liveText.length === freshText.length) {
    for (let i = 0; i < liveText.length; i += 1) {
      const next = freshText[i]!.textContent ?? "";
      if (liveText[i]!.textContent !== next) {
        liveText[i]!.textContent = next;
        written += 1;
      }
    }
  }

  const freshChildren = [...fresh.children];
  const taken = new Set<number>();
  for (const child of live.children) {
    const shape = signature(child);
    for (let i = 0; i < freshChildren.length; i += 1) {
      if (taken.has(i) || signature(freshChildren[i]!) !== shape) continue;
      taken.add(i);
      written += copyToolbarText(child, freshChildren[i]!);
      break;
    }
  }

  return written;
}

/**
 * Fetch the current page and patch the toolbar counters from it.
 * @returns True when something was rewritten.
 */
export async function syncFilesToolbar(): Promise<boolean> {
  const live = findFilesToolbar(document);
  if (!live) return false;

  let html: string;
  try {
    const response = await fetch(location.href, { credentials: "same-origin" });
    if (!response.ok) return false;
    html = await response.text();
  } catch {
    return false;
  }

  const fresh = findFilesToolbar(new DOMParser().parseFromString(html, "text/html"));
  if (!fresh) return false;

  return copyToolbarText(live, fresh) > 0;
}

/**
 * Patch the toolbar after a comment change, retrying once.
 * GitHub's HTML can still show the old counts immediately after a write, so a
 * pass that changes nothing is worth one more try before giving up.
 * @returns True when something was rewritten.
 */
export async function syncFilesToolbarSoon(): Promise<boolean> {
  if (inFlight) return false;
  inFlight = true;
  try {
    if (await syncFilesToolbar()) return true;
    await delay(RETRY_DELAY_MS);
    return await syncFilesToolbar();
  } finally {
    inFlight = false;
  }
}

/**
 * List the direct text-node children of an element.
 * @param el - The element to read.
 * @returns Its text nodes, in order.
 */
function textChildren(el: Element): Text[] {
  return [...el.childNodes].filter((node): node is Text => node.nodeType === Node.TEXT_NODE);
}

/**
 * Describe an element's shape for matching it across the two documents.
 * Class names carry a per-deploy hash, so only the first class is used and
 * only as a tiebreaker alongside the stable attributes.
 * @param el - The element to describe.
 * @returns A comparable signature string.
 */
function signature(el: Element): string {
  return [
    el.tagName,
    el.getAttribute("data-component") ?? "",
    el.getAttribute("data-testid") ?? "",
    (el.getAttribute("class") ?? "").split(/\s+/)[0] ?? "",
  ].join("|");
}

/**
 * Wait for a number of milliseconds.
 * @param ms - The delay.
 * @returns A promise that resolves after the delay.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
