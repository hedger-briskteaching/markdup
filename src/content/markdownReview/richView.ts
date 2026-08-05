import type { Node as PMNode } from 'prosemirror-model'
import type { RowModel } from '../../markdown/align'
import { buildViewSections } from '../../markdown/viewSections'
import { DIFF_BODY, RGM_STUB } from './selectors'
import {
  bindOverlayRepaint,
  clearRichViewContext,
  setRichViewContext,
} from './selection'
import { bindComposer } from './composer'
import {
  bindFileCollapseSync,
  bindHeaderControlSuppress,
  showInterferingHeaderControls,
  unbindFileCollapseSync,
} from './headerControls'
import { buildRichRoot } from './renderBody'
import type { CommentableLines } from '../../shared/commentableLines'

/** Attribute used to hide the native diff body. */
const HIDDEN_ATTR = 'data-rgm-diff-hidden'

const composerCleanups = new WeakMap<Element, () => void>()
const overlayCleanups = new WeakMap<Element, () => void>()

export type ShowRichViewOptions = {
  baseText?: string
  headText?: string
  owner?: string
  repo?: string
  pullNumber?: number
  path?: string
  baseSha?: string
  headSha?: string
  commentable?: CommentableLines
  viewerLogin?: string
}

/**
 * Find the native diff body element within a file region.
 * @param region - The file region element.
 * @returns The diff body element, or null if not found.
 */
function findDiffBody(region: Element): HTMLElement | null {
  const header = region.querySelector('[data-diff-header-wrapper]')
  if (header?.parentElement === region) {
    let sibling = header.nextElementSibling
    while (sibling) {
      if (
        sibling instanceof HTMLElement &&
        sibling.querySelector('table[aria-label^="Diff for:"]')
      ) {
        return sibling
      }
      sibling = sibling.nextElementSibling
    }
  }

  return region.querySelector<HTMLElement>(DIFF_BODY)
}

/**
 * Hide the native source diff and show the rich Before/After view.
 * Unchanged sections start collapsed behind fold bars.
 * @param region - The file region element.
 * @param rows - Aligned row models for the diff.
 * @param options - Text, metadata, and configuration for the view.
 * @returns Nothing.
 */
export function showRichView(
  region: Element,
  rows: RowModel[],
  options: ShowRichViewOptions = {},
): void {
  const diffBody = findDiffBody(region)
  if (!diffBody) {
    return
  }

  diffBody.setAttribute(HIDDEN_ATTR, '')
  region.querySelector('[data-rgm-auth-panel]')?.remove()

  let root = region.querySelector<HTMLElement>('[data-rgm-rich]')
  if (!root) {
    root = document.createElement('div')
    root.setAttribute('data-rgm-rich', '')
    root.setAttribute('data-rgm-stub', '')
    diffBody.after(root)
  }

  const expanded = new Set<string>()
  setRichViewContext(root, {
    baseText: options.baseText ?? '',
    headText: options.headText ?? '',
    rows,
    owner: options.owner,
    repo: options.repo,
    pullNumber: options.pullNumber,
    path: options.path,
    baseSha: options.baseSha,
    headSha: options.headSha,
    commentable: options.commentable,
    viewerLogin: options.viewerLogin,
    expandedUnchangedIds: expanded,
  })
  root.replaceChildren(buildRichRoot(rows, expanded))
  composerCleanups.get(root)?.()
  composerCleanups.set(root, bindComposer(root))
  overlayCleanups.get(root)?.()
  overlayCleanups.set(root, bindOverlayRepaint(root))
  bindHeaderControlSuppress(region)
  bindFileCollapseSync(region)
}

/**
 * Show a loading indicator inside the rich view container.
 * @param region - The file region element.
 * @returns Nothing.
 */
export function showRichLoading(region: Element): void {
  const diffBody = findDiffBody(region)
  if (!diffBody) {
    return
  }
  diffBody.setAttribute(HIDDEN_ATTR, '')
  region.querySelector('[data-rgm-auth-panel]')?.remove()

  let root = region.querySelector<HTMLElement>('[data-rgm-rich]')
  if (!root) {
    root = document.createElement('div')
    root.setAttribute('data-rgm-rich', '')
    root.setAttribute('data-rgm-stub', '')
    diffBody.after(root)
  }

  root.replaceChildren()
  const status = document.createElement('p')
  status.className = 'rgm-rich-status'
  status.textContent = 'Loading rich Markdown view…'
  root.appendChild(status)
  bindHeaderControlSuppress(region)
  bindFileCollapseSync(region)
}

/**
 * Show an error message inside the rich view container.
 * @param region - The file region element.
 * @param message - Error text to display.
 * @returns Nothing.
 */
export function showRichError(region: Element, message: string): void {
  const diffBody = findDiffBody(region)
  if (!diffBody) {
    return
  }
  diffBody.setAttribute(HIDDEN_ATTR, '')

  let root = region.querySelector<HTMLElement>('[data-rgm-rich]')
  if (!root) {
    root = document.createElement('div')
    root.setAttribute('data-rgm-rich', '')
    root.setAttribute('data-rgm-stub', '')
    diffBody.after(root)
  }

  root.replaceChildren()
  const status = document.createElement('p')
  status.className = 'rgm-rich-status rgm-rich-status-error'
  status.textContent = message
  root.appendChild(status)
  bindHeaderControlSuppress(region)
  bindFileCollapseSync(region)
}

/**
 * Remove the rich view and restore the native source diff.
 * @param region - The file region element.
 * @returns Nothing.
 */
export function hideRichView(region: Element): void {
  showInterferingHeaderControls(region)
  unbindFileCollapseSync(region)
  const diffBody = findDiffBody(region)
  diffBody?.removeAttribute(HIDDEN_ATTR)
  const rich = region.querySelector('[data-rgm-rich]')
  if (rich) {
    composerCleanups.get(rich)?.()
    composerCleanups.delete(rich)
    overlayCleanups.get(rich)?.()
    overlayCleanups.delete(rich)
    clearRichViewContext(rich)
    rich.remove()
  }
  region.querySelector(RGM_STUB)?.remove()
}

/**
 * Re-hide the native diff body after GitHub remounts it on expand.
 * @param region - The file region element.
 * @returns Nothing.
 */
export function ensureNativeDiffHidden(region: Element): void {
  const diffBody = findDiffBody(region)
  if (diffBody) {
    diffBody.setAttribute(HIDDEN_ATTR, '')
  }
}

/**
 * Determine if a file region is in rich mode.
 * @param region - The file region element.
 * @returns True when the region is in rich mode.
 */
export function isRichMode(region: Element): boolean {
  return region.getAttribute('data-rgm-mode') === 'rich'
}

/**
 * Render rows to an isolated element for testing.
 * Unchanged sections render expanded unless startCollapsed is set.
 * @internal Test helper.
 * @param rows - Aligned row models for the diff.
 * @param options - View configuration with optional startCollapsed flag.
 * @returns The rendered host element.
 */
export function renderRowsForTest(
  rows: RowModel[],
  options: ShowRichViewOptions & { startCollapsed?: boolean } = {},
): HTMLElement {
  const host = document.createElement('div')
  host.setAttribute('data-rgm-rich', '')

  const expanded = options.startCollapsed
    ? new Set<string>()
    : new Set(
        buildViewSections(rows)
          .filter((s) => s.kind === 'unchanged')
          .map((s) => s.id),
      )

  setRichViewContext(host, {
    baseText: options.baseText ?? '',
    headText: options.headText ?? '',
    rows,
    owner: options.owner,
    repo: options.repo,
    pullNumber: options.pullNumber,
    path: options.path,
    baseSha: options.baseSha,
    headSha: options.headSha,
    commentable: options.commentable,
    viewerLogin: options.viewerLogin,
    expandedUnchangedIds: expanded,
  })
  host.appendChild(buildRichRoot(rows, expanded))
  return host
}

/**
 * Expose node text content for tests.
 * @internal Test helper.
 * @param node - A ProseMirror document node.
 * @returns The plain text content of the node.
 */
export function blockTextForTest(node: PMNode): string {
  return node.textContent
}
