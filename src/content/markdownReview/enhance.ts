/**
 * Scanning half of the markdown review UI.
 * Kept apart from `init` so this module and its markdown/ProseMirror
 * dependencies load only on a PR Files or Changes page.
 */
import { getFilePath, isMarkdownPath, isPrFilesPage } from './detect'
import { hasRichPathIntent } from './richIntent'
import { ensureRichMounted } from './richStub'
import { FILE_REGION } from './selectors'
import { injectToggle } from './toggle'

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
