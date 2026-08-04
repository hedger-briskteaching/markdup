import { getFilePath, isMarkdownPath, isPrFilesPage } from './detect'
import { hasRichPathIntent } from './richIntent'
import { ensureRichMounted } from './richStub'
import { FILE_REGION, PROGRESSIVE_DIFFS_LIST } from './selectors'
import { injectStyles, removeStyles } from './styles'
import { injectToggle } from './toggle'

/** Milliseconds to wait after a DOM mutation before scanning again. */
const DEBOUNCE_MS = 75

/** Diff-list observer used while the Files page is active. */
let observer: MutationObserver | null = null
/** Persistent observer that detects soft navigations via pathname changes. */
let pathObserver: MutationObserver | null = null
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let started = false
let pageActive = false
/** Last pathname handled by navigation logic. Null before the first check. */
let lastPathname: string | null = null

/**
 * Scan the page and inject toggle controls on markdown file regions.
 * @returns Nothing.
 */
export function enhanceMarkdownRegions(): void {
  if (!isPrFilesPage()) {
    return
  }

  const regions = document.querySelectorAll(FILE_REGION)
  for (const region of regions) {
    const path = getFilePath(region)
    if (!path || !isMarkdownPath(path)) {
      continue
    }

    injectToggle(region, path)

    // Collapse/expand can destroy [data-rgm-rich] while intent stays on.
    if (hasRichPathIntent(path)) {
      ensureRichMounted(region)
    }
  }
}

/**
 * Schedule a debounced page scan after a DOM mutation.
 * @returns Nothing.
 */
function scheduleScan(): void {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer)
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    enhanceMarkdownRegions()
  }, DEBOUNCE_MS)
}

/**
 * Attach a MutationObserver to the diff list or document body.
 * @returns Nothing.
 */
function observeRoot(): void {
  observer?.disconnect()

  const root =
    document.querySelector(PROGRESSIVE_DIFFS_LIST) ?? document.body

  observer = new MutationObserver(() => {
    scheduleScan()
  })
  observer.observe(root, { childList: true, subtree: true })
}

/**
 * Drop diff observers, pending scans, and injected styles when leaving Files.
 * Does not disconnect the persistent pathname watcher.
 * @returns Nothing.
 */
function deactivatePage(): void {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  observer?.disconnect()
  observer = null
  removeStyles()
  pageActive = false
}

/**
 * Inject styles, start observing, and trigger the first scan.
 * @returns Nothing.
 */
function activatePage(): void {
  injectStyles()
  observeRoot()
  scheduleScan()
  pageActive = true
}

/**
 * Activate or deactivate the extension based on the current URL.
 * @returns Nothing.
 */
function onNavigation(): void {
  if (!isPrFilesPage()) {
    if (pageActive) {
      deactivatePage()
    }
    return
  }
  activatePage()
}

/**
 * Run navigation logic only when location.pathname has changed.
 * @returns Nothing.
 */
function handleLocationChange(): void {
  let pathname: string
  try {
    pathname = window.location.pathname
  } catch {
    return
  }
  if (!pathname || pathname === lastPathname) {
    return
  }
  lastPathname = pathname
  onNavigation()
}

/**
 * Watch document mutations for soft navigations that change the pathname.
 * Content scripts cannot reliably patch the page-world History API.
 * @returns Nothing.
 */
function observePathname(): void {
  pathObserver?.disconnect()
  pathObserver = new MutationObserver(() => {
    handleLocationChange()
  })
  pathObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  })
}

/**
 * Reset module state for unit tests.
 * @returns Nothing.
 */
export function resetInitForTests(): void {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  observer?.disconnect()
  observer = null
  pathObserver?.disconnect()
  pathObserver = null
  removeStyles()
  pageActive = false
  started = false
  lastPathname = null
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
    handleLocationChange()
    return
  }
  started = true

  handleLocationChange()
  observePathname()

  document.addEventListener('turbo:load', handleLocationChange)
  document.addEventListener('turbo:render', handleLocationChange)
  document.addEventListener('pjax:end', handleLocationChange)

  // Soft SPA navigations that do not fire turbo/pjax events (same JS world).
  const pushState = history.pushState.bind(history)
  history.pushState = (...args) => {
    pushState(...args)
    handleLocationChange()
  }
  const replaceState = history.replaceState.bind(history)
  history.replaceState = (...args) => {
    replaceState(...args)
    handleLocationChange()
  }
  window.addEventListener('popstate', handleLocationChange)
}
