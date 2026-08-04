import { getFilePath, isMarkdownPath, isPrFilesPage } from './detect'
import { hasRichPathIntent } from './richIntent'
import { ensureRichMounted } from './richStub'
import { FILE_REGION, PROGRESSIVE_DIFFS_LIST } from './selectors'
import { injectStyles, removeStyles } from './styles'
import { injectToggle } from './toggle'

/** Milliseconds to wait after a DOM mutation before scanning again. */
const DEBOUNCE_MS = 75

let observer: MutationObserver | null = null
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let started = false
let pageActive = false

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
 * Drop observers, pending scans, and injected styles when leaving Files.
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
 * Start the markdown review UI on GitHub PR Files changed pages.
 * Safe to call once from the content script entry point.
 * Tears down automatically when the URL is not a Files or Changes view.
 * @returns Nothing.
 */
export function initMarkdownReview(): void {
  if (started) {
    onNavigation()
    return
  }
  started = true

  onNavigation()

  document.addEventListener('turbo:load', onNavigation)
  document.addEventListener('turbo:render', onNavigation)
  document.addEventListener('pjax:end', onNavigation)

  // Soft SPA navigations that do not fire turbo/pjax events.
  const pushState = history.pushState.bind(history)
  history.pushState = (...args) => {
    pushState(...args)
    onNavigation()
  }
  const replaceState = history.replaceState.bind(history)
  history.replaceState = (...args) => {
    replaceState(...args)
    onNavigation()
  }
  window.addEventListener('popstate', onNavigation)
}
