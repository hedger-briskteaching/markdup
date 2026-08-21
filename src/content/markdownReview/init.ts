/**
 * Navigation half of the markdown review UI.
 * Runs on every GitHub page, so it stays light: the scan module and its
 * markdown dependencies load on demand once a Files or Changes URL is active.
 */
import { bindCommentAnchor, followCommentHash } from "./commentAnchor";
import { isPrFilesPage } from "./detect";
import { PROGRESSIVE_DIFFS_LIST } from "./selectors";
import { injectStyles, removeStyles } from "./styles";

/** Milliseconds to wait after a DOM mutation before scanning again. */
const DEBOUNCE_MS = 75;

/** Diff-list observer used while the Files page is active. */
let observer: MutationObserver | null = null;
/** Persistent observer that detects soft navigations via pathname changes. */
let pathObserver: MutationObserver | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let started = false;
let pageActive = false;
/** Last pathname handled by navigation logic. Null before the first check. */
let lastPathname: string | null = null;

/**
 * Load the scan module on demand and enhance markdown regions.
 * @returns A promise that resolves after the scan, or after a skipped scan.
 */
async function runScan(): Promise<void> {
  const { enhanceMarkdownRegions } = await import("./enhance");
  // The page can navigate away while the module is still loading.
  if (!pageActive) {
    return;
  }
  enhanceMarkdownRegions();
}

/**
 * Schedule a debounced page scan after a DOM mutation.
 * @returns Nothing.
 */
function scheduleScan(): void {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void runScan();
  }, DEBOUNCE_MS);
}

/**
 * Attach a MutationObserver to the diff list or document body.
 * @returns Nothing.
 */
function observeRoot(): void {
  observer?.disconnect();

  const root = document.querySelector(PROGRESSIVE_DIFFS_LIST) ?? document.body;

  observer = new MutationObserver(() => {
    scheduleScan();
  });
  observer.observe(root, { childList: true, subtree: true });
}

/**
 * Drop diff observers, pending scans, and injected styles when leaving Files.
 * Does not disconnect the persistent pathname watcher.
 * @returns Nothing.
 */
function deactivatePage(): void {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  observer?.disconnect();
  observer = null;
  removeStyles();
  pageActive = false;
}

/**
 * Inject styles, start observing, and trigger the first scan.
 * @returns Nothing.
 */
function activatePage(): void {
  pageActive = true;
  injectStyles();
  observeRoot();
  scheduleScan();
}

/**
 * Activate or deactivate the extension based on the current URL.
 * @returns Nothing.
 */
function onNavigation(): void {
  if (!isPrFilesPage()) {
    if (pageActive) {
      deactivatePage();
    }
    return;
  }
  activatePage();
}

/**
 * Run navigation logic only when location.pathname has changed.
 * @returns Nothing.
 */
function handleNavigation(): void {
  handleLocationChange();
  // A soft navigation can carry a comment anchor without changing the
  // pathname, which handleLocationChange ignores.
  followCommentHash();
}

/**
 * React to a pathname change, ignoring navigations that keep the same path.
 * @returns Nothing.
 */
function handleLocationChange(): void {
  let pathname: string;
  try {
    pathname = window.location.pathname;
  } catch {
    return;
  }
  if (!pathname || pathname === lastPathname) {
    return;
  }
  lastPathname = pathname;
  onNavigation();
}

/**
 * Watch document mutations for soft navigations that change the pathname.
 * Content scripts cannot reliably patch the page-world History API.
 * @returns Nothing.
 */
function observePathname(): void {
  pathObserver?.disconnect();
  pathObserver = new MutationObserver(() => {
    handleLocationChange();
  });
  pathObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

/**
 * Reset module state for unit tests.
 * @returns Nothing.
 */
export function resetInitForTests(): void {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  observer?.disconnect();
  observer = null;
  pathObserver?.disconnect();
  pathObserver = null;
  removeStyles();
  pageActive = false;
  started = false;
  lastPathname = null;
}

/**
 * Start the markdown review UI on GitHub pull request pages.
 * Safe to call once from the content script entry point.
 * Stays idle until the URL is a Files or Changes view, then activates.
 * Tears down automatically when the URL leaves Files or Changes.
 * @returns Nothing.
 */
export function initMarkdownReview(): void {
  if (started) {
    handleLocationChange();
    return;
  }
  started = true;

  handleLocationChange();
  observePathname();
  bindCommentAnchor();

  // GitHub soft-nav events (not standard DOM events). GitHub is an SPA: many
  // clicks swap page content without a full reload, so content scripts must
  // re-check the URL when those navigations finish.
  // - turbo:load — Hotwire Turbo: visit finished and the new page is in the DOM
  // - turbo:render — Hotwire Turbo: body was re-rendered (incl. cache restore)
  // - pjax:end — legacy jQuery pjax; still used on some older GitHub flows
  document.addEventListener("turbo:load", handleNavigation);
  document.addEventListener("turbo:render", handleNavigation);
  document.addEventListener("pjax:end", handleNavigation);

  // Soft SPA navigations that do not fire turbo/pjax events (same JS world).
  const pushState = history.pushState.bind(history);
  history.pushState = (...args) => {
    pushState(...args);
    handleNavigation();
  };
  const replaceState = history.replaceState.bind(history);
  history.replaceState = (...args) => {
    replaceState(...args);
    handleNavigation();
  };
  window.addEventListener("popstate", handleNavigation);
}
