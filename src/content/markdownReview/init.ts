import { getFilePath, isMarkdownPath, isPrFilesPage } from './detect'
import { hasRichPathIntent } from './richIntent'
import { ensureRichMounted } from './richStub'
import { FILE_REGION, PROGRESSIVE_DIFFS_LIST } from './selectors'
import { injectStyles } from './styles'
import { injectToggle } from './toggle'

const DEBOUNCE_MS = 75

let observer: MutationObserver | null = null
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let started = false

/** Scan the page and inject toggles on markdown file regions. */
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

    // Collapse/expand may destroy `[data-rgm-rich]` while intent stays on.
    if (hasRichPathIntent(path)) {
      ensureRichMounted(region)
    }
  }
}

function scheduleScan(): void {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer)
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    enhanceMarkdownRegions()
  }, DEBOUNCE_MS)
}

function observeRoot(): void {
  observer?.disconnect()

  const root =
    document.querySelector(PROGRESSIVE_DIFFS_LIST) ?? document.body

  observer = new MutationObserver(() => {
    scheduleScan()
  })
  observer.observe(root, { childList: true, subtree: true })
}

function onNavigation(): void {
  if (!isPrFilesPage()) {
    return
  }
  injectStyles()
  observeRoot()
  scheduleScan()
}

/**
 * Start markdown review UI on GitHub PR Files changed pages.
 * Safe to call once from the content script entry.
 */
export function initMarkdownReview(): void {
  if (started) {
    return
  }
  started = true

  injectStyles()
  onNavigation()

  document.addEventListener('turbo:load', onNavigation)
  document.addEventListener('turbo:render', onNavigation)
  document.addEventListener('pjax:end', onNavigation)

  // Soft SPA navigations that may not fire turbo/pjax events
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
