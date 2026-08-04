import type { Node as PMNode } from 'prosemirror-model'
import type { RowModel } from '../../markdown/align'
import { buildViewSections } from '../../markdown/viewSections'
import { DIFF_BODY, RGM_STUB } from './selectors'
import {
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

const HIDDEN_ATTR = 'data-rgm-diff-hidden'

const composerCleanups = new WeakMap<Element, () => void>()

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
 * Unchanged sections start collapsed behind +/- fold bars.
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
  bindHeaderControlSuppress(region)
  bindFileCollapseSync(region)
}

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

export function hideRichView(region: Element): void {
  showInterferingHeaderControls(region)
  unbindFileCollapseSync(region)
  const diffBody = findDiffBody(region)
  diffBody?.removeAttribute(HIDDEN_ATTR)
  const rich = region.querySelector('[data-rgm-rich]')
  if (rich) {
    composerCleanups.get(rich)?.()
    composerCleanups.delete(rich)
    clearRichViewContext(rich)
    rich.remove()
  }
  region.querySelector(RGM_STUB)?.remove()
}

/** Re-hide the native diff body after GitHub remounts it (e.g. expand). */
export function ensureNativeDiffHidden(region: Element): void {
  const diffBody = findDiffBody(region)
  if (diffBody) {
    diffBody.setAttribute(HIDDEN_ATTR, '')
  }
}

export function isRichMode(region: Element): boolean {
  return region.getAttribute('data-rgm-mode') === 'rich'
}

/**
 * @internal Test helper — render rows to an isolated element.
 * Unchanged sections render expanded unless `startCollapsed` is set, so
 * selection-oriented tests can reach text inside equal rows.
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

/** @internal Expose node text for tests. */
export function blockTextForTest(node: PMNode): string {
  return node.textContent
}
