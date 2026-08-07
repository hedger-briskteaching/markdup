import { createPayloadFromRange } from '../../shared/reviewComment'
import type { SourceRange } from '../../markdown/sourceRange'
import type { ReviewCommentDto } from '../../shared/messages'
import {
  mountCommentEditor,
  type CommentEditorHandle,
} from './commentEditor'
import {
  applySelectionHighlight,
  clearSelectionHighlight,
  findCellForSourceRange,
  getRichViewContext,
  selectionToSourceRange,
  snapDomSelectionToSourceRange,
  type RichViewContext,
} from './selection'
import { FILE_REGION } from './selectors'
import { syncFilesToolbarSoon } from './toolbarSync'
import { syncThreadsFromServer } from './syncThreads'

const BUBBLE_ATTR = 'data-rgm-comment-bubble'
const COMPOSER_ATTR = 'data-rgm-composer'
const COMMENTS_DIRTY_ATTR = 'data-rgm-comments-dirty'

type PendingSelection = {
  range: SourceRange
  ctx: RichViewContext
  /** Client rect of the live DOM selection for bubble placement. */
  clientRect: DOMRect
}

/**
 * Listen for text selections inside a rich root.
 * Shows a small Comment bubble first, then expands to a composer on click.
 * @param richRoot - The rich view root element.
 * @returns A cleanup function that removes all listeners and UI.
 */
export function bindComposer(richRoot: HTMLElement): () => void {
  /**
   * After mouse-up, show the Comment bubble for the current selection.
   * @returns Nothing.
   */
  const onMouseUp = () => {
    window.setTimeout(() => {
      maybeShowBubble(richRoot)
    }, 0)
  }

  /**
   * Clear the composer UI when the user presses Escape.
   * @param event - Keyboard event from the document.
   * @returns Nothing.
   */
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      clearUi(richRoot)
    }
  }

  /**
   * Clear the bubble when the pointer presses outside the composer UI.
   * @param event - Pointer event from the document.
   * @returns Nothing.
   */
  const onPointerDown = (event: PointerEvent) => {
    const target = event.target
    if (!(target instanceof Node)) return
    if (
      richRoot.querySelector(`[${BUBBLE_ATTR}]`)?.contains(target) ||
      richRoot.querySelector(`[${COMPOSER_ATTR}]`)?.contains(target)
    ) {
      return
    }
    if (richRoot.querySelector(`[${COMPOSER_ATTR}]`)) {
      return
    }
    if (!richRoot.contains(target)) {
      removeBubble(richRoot)
      clearSelectionHighlight(richRoot)
      return
    }
    removeBubble(richRoot)
  }

  richRoot.addEventListener('mouseup', onMouseUp)
  document.addEventListener('keydown', onKeyDown)
  document.addEventListener('pointerdown', onPointerDown, true)

  return () => {
    richRoot.removeEventListener('mouseup', onMouseUp)
    document.removeEventListener('keydown', onKeyDown)
    document.removeEventListener('pointerdown', onPointerDown, true)
    clearUi(richRoot)
  }
}

/**
 * Show the comment bubble when a valid selection exists inside the rich root.
 * @param richRoot - The rich view root element.
 * @returns Nothing.
 */
function maybeShowBubble(richRoot: HTMLElement): void {
  try {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      removeBubble(richRoot)
      if (!richRoot.querySelector(`[${COMPOSER_ATTR}]`)) {
        clearSelectionHighlight(richRoot)
      }
      return
    }

    // Selecting inside comment UI must not steal the selection or spawn a bubble.
    if (selectionIsInCommentUi(selection, richRoot)) {
      return
    }

    const range = selectionToSourceRange(selection, richRoot)
    if (!range) {
      removeBubble(richRoot)
      if (!richRoot.querySelector(`[${COMPOSER_ATTR}]`)) {
        clearSelectionHighlight(richRoot)
      }
      return
    }

    // A new selection replaces any open composer (GitHub-style).
    richRoot.querySelector(`[${COMPOSER_ATTR}]`)?.remove()

    const ctx = getRichViewContext(richRoot)
    if (!ctx?.owner || !ctx.repo || !ctx.pullNumber || !ctx.path) {
      return
    }

    const liveRange =
      selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null
    const snapped = snapDomSelectionToSourceRange(selection, richRoot, range)
    const forRect =
      snapped ??
      liveRange ??
      (selection.rangeCount > 0 ? selection.getRangeAt(0) : null)
    if (!forRect) {
      removeBubble(richRoot)
      return
    }

    applySelectionHighlight(richRoot, range)
    const clientRect = rectForDomRange(forRect, richRoot)
    showBubble(richRoot, { range, ctx, clientRect })
  } catch (error) {
    console.warn('[Markdup] selection comment bubble failed', error)
  }
}

/**
 * Determine if the live selection is inside composer, thread, or editor chrome.
 * @param selection - The browser Selection object.
 * @param richRoot - The rich view root element.
 * @returns True when the selection is inside comment UI.
 */
function selectionIsInCommentUi(
  selection: Selection,
  richRoot: Element,
): boolean {
  if (selection.rangeCount === 0) return false
  const node = selection.getRangeAt(0).commonAncestorContainer
  const el = node instanceof Element ? node : node.parentElement
  if (!el || !richRoot.contains(el)) return false
  return Boolean(
    el.closest(
      `[${COMPOSER_ATTR}], [data-rgm-thread-card], [data-rgm-comment-bubble], .rgm-comment-editor`,
    ),
  )
}

/**
 * Get a bounding rect for a DOM range, with fallback for jsdom.
 * @param domRange - The DOM Range to measure.
 * @param richRoot - The rich view root element.
 * @returns A DOMRect for positioning.
 */
function rectForDomRange(domRange: Range, richRoot: HTMLElement): DOMRect {
  if (typeof domRange.getBoundingClientRect === 'function') {
    const rect = domRange.getBoundingClientRect()
    if (rect.width > 0 || rect.height > 0) {
      return rect
    }
  }

  const rootRect = richRoot.getBoundingClientRect()
  if (rootRect.width > 0 || rootRect.height > 0) {
    return rootRect
  }

  return new DOMRect(8, 8, 120, 24)
}

/**
 * Show the comment bubble near the selected text.
 * @param richRoot - The rich view root element.
 * @param pending - The pending selection state with range and context.
 * @returns Nothing.
 */
function showBubble(richRoot: HTMLElement, pending: PendingSelection): void {
  removeBubble(richRoot)

  const bubble = document.createElement('div')
  bubble.setAttribute(BUBBLE_ATTR, '')
  bubble.className = 'rgm-comment-bubble'
  bubble.setAttribute('role', 'toolbar')
  bubble.setAttribute('aria-label', 'Selection actions')

  const commentBtn = document.createElement('button')
  commentBtn.type = 'button'
  commentBtn.className = 'rgm-comment-bubble-btn'
  commentBtn.innerHTML =
    '<span class="rgm-comment-bubble-icon" aria-hidden="true">✎</span> Comment'
  commentBtn.addEventListener('mousedown', (event) => {
    event.preventDefault()
  })
  commentBtn.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    removeBubble(richRoot)
    showComposer(richRoot, pending.range, pending.ctx, pending.clientRect)
  })

  const ref = document.createElement('span')
  ref.className = 'rgm-comment-bubble-ref'
  ref.textContent = formatLineRef(pending.range)

  bubble.append(commentBtn, ref)
  richRoot.appendChild(bubble)
  positionBubble(bubble, richRoot, pending.clientRect)
}

/**
 * Position the bubble above (or below) the selected text.
 * @param bubble - The bubble element to position.
 * @param richRoot - The rich view root element.
 * @param clientRect - The bounding rect of the selection.
 * @returns Nothing.
 */
function positionBubble(
  bubble: HTMLElement,
  richRoot: HTMLElement,
  clientRect: DOMRect,
): void {
  const rootRect = richRoot.getBoundingClientRect()
  const gap = 8
  let top = clientRect.top - rootRect.top - gap
  let left = clientRect.left - rootRect.left

  const bubbleRect = bubble.getBoundingClientRect()
  top -= bubbleRect.height
  if (top < 4) {
    top = clientRect.bottom - rootRect.top + gap
  }
  const maxLeft = Math.max(4, rootRect.width - bubbleRect.width - 4)
  left = Math.min(Math.max(4, left), maxLeft)

  bubble.style.top = `${Math.round(top)}px`
  bubble.style.left = `${Math.round(left)}px`
}

/**
 * Open the comment composer anchored under the live text selection.
 * @param richRoot - The rich view root element.
 * @param range - The source range for the comment.
 * @param ctx - The rich view context.
 * @param clientRect - The bounding rect of the selection.
 * @returns Nothing.
 */
function showComposer(
  richRoot: HTMLElement,
  range: SourceRange,
  ctx: RichViewContext,
  clientRect: DOMRect,
): void {
  richRoot.querySelector(`[${COMPOSER_ATTR}]`)?.remove()

  const panel = document.createElement('div')
  panel.setAttribute(COMPOSER_ATTR, '')
  panel.className = 'rgm-composer'
  panel.setAttribute('data-side', range.side)

  const anchorRow = document.createElement('div')
  anchorRow.className = 'rgm-composer-anchor'
  const anchorLabel = document.createElement('span')
  anchorLabel.className = 'rgm-composer-anchor-label'
  anchorLabel.textContent = 'Anchored to'
  const pill = document.createElement('span')
  pill.className = 'rgm-composer-anchor-pill'
  pill.textContent = formatAnchorPill(ctx.path ?? '', range)
  const sideHint = document.createElement('span')
  sideHint.className = 'rgm-composer-anchor-side'
  sideHint.textContent = range.side === 'LEFT' ? 'Before' : 'After'
  anchorRow.append(anchorLabel, pill, sideHint)
  panel.appendChild(anchorRow)

  const editorHost = document.createElement('div')
  panel.appendChild(editorHost)

  const actions = document.createElement('div')
  actions.className = 'rgm-composer-actions'

  const status = document.createElement('span')
  status.className = 'rgm-composer-status'
  status.hidden = true

  const submit = document.createElement('button')
  submit.type = 'button'
  submit.className = 'rgm-composer-btn rgm-composer-btn-primary'
  submit.textContent = 'Add comment'

  const cancel = document.createElement('button')
  cancel.type = 'button'
  cancel.className = 'rgm-composer-btn rgm-composer-btn-secondary'
  cancel.textContent = 'Cancel'

  let editor: CommentEditorHandle | null = null

  cancel.addEventListener('click', () => {
    editor?.destroy()
    clearSelectionHighlight(richRoot)
    panel.remove()
  })

  submit.addEventListener('click', () => {
    void submitComment({
      panel,
      editor,
      submit,
      status,
      range,
      ctx,
    })
  })

  actions.append(submit, cancel, status)
  panel.appendChild(actions)

  applySelectionHighlight(richRoot, range)
  richRoot.appendChild(panel)
  positionComposer(panel, richRoot, clientRect, range)

  editor = mountCommentEditor(editorHost, {
    placeholder: 'Leave a comment',
    onSubmit: () => submit.click(),
  })

  if (typeof panel.scrollIntoView === 'function') {
    panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }

  editor.focus()
}

/**
 * Place the composer directly under the selected text (GitHub-style inline).
 * @param panel - The composer panel element.
 * @param richRoot - The rich view root element.
 * @param clientRect - The bounding rect of the selection.
 * @param range - The source range for column alignment.
 * @returns Nothing.
 */
function positionComposer(
  panel: HTMLElement,
  richRoot: HTMLElement,
  clientRect: DOMRect,
  range: SourceRange,
): void {
  const rootRect = richRoot.getBoundingClientRect()
  const gap = 8
  const preferredWidth = Math.min(
    440,
    Math.max(280, rootRect.width > 0 ? rootRect.width - 24 : 360),
  )

  let top = clientRect.bottom - rootRect.top + richRoot.scrollTop + gap
  let left = clientRect.left - rootRect.left + richRoot.scrollLeft

  panel.style.width = `${Math.round(preferredWidth)}px`

  const panelRect = panel.getBoundingClientRect()
  const panelWidth = panelRect.width > 0 ? panelRect.width : preferredWidth
  const maxLeft = Math.max(
    8,
    rootRect.width - panelWidth - 8 + richRoot.scrollLeft,
  )
  left = Math.min(Math.max(8, left), maxLeft)

  // Flip above the selection if the bubble overflows the bottom.
  if (
    rootRect.height > 0 &&
    clientRect.bottom - rootRect.top + gap + panelRect.height >
      rootRect.height &&
    clientRect.top - rootRect.top > panelRect.height + gap
  ) {
    top =
      clientRect.top -
      rootRect.top +
      richRoot.scrollTop -
      panelRect.height -
      gap
  }

  // Keep the panel in the selected Before/After column when possible.
  const cell = findCellForSourceRange(richRoot, range)
  if (cell) {
    const cellRect = cell.getBoundingClientRect()
    if (cellRect.width > 0) {
      const cellLeft = cellRect.left - rootRect.left + richRoot.scrollLeft
      const cellWidth = cellRect.width
      const width = Math.min(preferredWidth, Math.max(240, cellWidth - 16))
      panel.style.width = `${Math.round(width)}px`
      left = Math.min(
        Math.max(cellLeft + 8, left),
        Math.max(cellLeft + 8, cellLeft + cellWidth - width - 8),
      )
    }
  }

  panel.style.top = `${Math.round(Math.max(4, top))}px`
  panel.style.left = `${Math.round(left)}px`
}

/**
 * Submit a new review comment to GitHub via the background script.
 * @param args - Editor, UI elements, range, and context needed for submission.
 * @returns Nothing.
 */
async function submitComment(args: {
  panel: HTMLElement
  editor: CommentEditorHandle | null
  submit: HTMLButtonElement
  status: HTMLElement
  range: SourceRange
  ctx: RichViewContext
}): Promise<void> {
  const { panel, editor, submit, status, range, ctx } = args
  const body = editor?.getMarkdown().trim() ?? ''
  if (!body) {
    status.hidden = false
    status.textContent = 'Write a comment first.'
    status.classList.add('rgm-composer-status-error')
    return
  }

  if (!ctx.owner || !ctx.repo || !ctx.pullNumber || !ctx.path) {
    return
  }

  const commitId = ctx.headSha || ctx.baseSha
  if (!commitId) {
    status.hidden = false
    status.textContent = 'Missing commit SHA for this file.'
    status.classList.add('rgm-composer-status-error')
    return
  }

  const payload = createPayloadFromRange({
    body,
    path: ctx.path,
    commitId,
    side: range.side,
    startLine: range.startLine,
    endLine: range.endLine,
  })

  submit.disabled = true
  status.hidden = false
  status.classList.remove('rgm-composer-status-error')
  status.textContent = 'Posting…'

  const response = (await chrome.runtime.sendMessage({
    type: 'CREATE_REVIEW_COMMENT',
    owner: ctx.owner,
    repo: ctx.repo,
    pullNumber: ctx.pullNumber,
    ...payload,
  })) as ReviewCommentDto | { error: string }

  if (response && 'error' in response) {
    submit.disabled = false
    status.textContent = response.error
    status.classList.add('rgm-composer-status-error')
    return
  }

  const richRoot = richRootFrom(panel)
  // The comment is on the server now, so GitHub's page is already stale.
  // Flag it before the sync, which may fail for its own reasons.
  if (richRoot) {
    markCommentsDirty(richRoot)
  }

  status.textContent = 'Syncing with GitHub…'

  const synced = richRoot
    ? await syncThreadsFromServer(richRoot, ctx, {
        expectCommentId: response.id,
      })
    : { ok: false as const, error: 'Rich view closed before sync finished.' }

  if (!synced.ok) {
    submit.disabled = false
    status.textContent = synced.error
    status.classList.add('rgm-composer-status-error')
    return
  }

  status.textContent = 'Added to your pending review.'
  window.setTimeout(() => {
    editor?.destroy()
    if (richRoot) clearSelectionHighlight(richRoot)
    panel.remove()
  }, 400)
}

/**
 * Mark that GitHub's own page state is stale due to API comment changes,
 * and correct the counters it shows.
 *
 * The dirty flag stays set regardless: the toolbar is only part of what
 * GitHub renders from stale state, and leaving rich mode still reloads so
 * the rest of its UI catches up.
 * @param richRoot - The rich view root element.
 * @returns Nothing.
 */
export function markCommentsDirty(richRoot: Element): void {
  const region = richRoot.closest(FILE_REGION) ?? richRoot.parentElement
  region?.setAttribute(COMMENTS_DIRTY_ATTR, '')
  document.documentElement.setAttribute(COMMENTS_DIRTY_ATTR, '')

  void syncFilesToolbarSoon()
}

/**
 * Consume and clear the comments-dirty flag for a region.
 * @param region - The file region element.
 * @returns True if any dirty flag was set.
 */
export function consumeCommentsDirty(region: Element): boolean {
  const local = region.hasAttribute(COMMENTS_DIRTY_ATTR)
  const global = document.documentElement.hasAttribute(COMMENTS_DIRTY_ATTR)
  region.removeAttribute(COMMENTS_DIRTY_ATTR)
  document.documentElement.removeAttribute(COMMENTS_DIRTY_ATTR)
  return local || global
}

/**
 * Find the rich root ancestor of a panel element.
 * @param panel - The composer panel element.
 * @returns The rich root element, or null.
 */
function richRootFrom(panel: HTMLElement): HTMLElement | null {
  return panel.closest('[data-rgm-rich]')
}

/**
 * Format a source range as a line reference string (for example "L5" or "L5-10").
 * @param range - The source range.
 * @returns The formatted line reference.
 */
function formatLineRef(range: SourceRange): string {
  if (range.startLine === range.endLine) {
    return `L${range.startLine}`
  }
  return `L${range.startLine}–${range.endLine}`
}

/**
 * Format the anchor pill text showing file name and line reference.
 * @param path - The file path.
 * @param range - The source range.
 * @returns The formatted pill text.
 */
function formatAnchorPill(path: string, range: SourceRange): string {
  const name = path.split('/').pop() || path || 'file'
  return `${name} ${formatLineRef(range)}`
}

/**
 * Remove the comment bubble from the rich root.
 * @param richRoot - The rich view root element.
 * @returns Nothing.
 */
function removeBubble(richRoot: Element): void {
  richRoot.querySelector(`[${BUBBLE_ATTR}]`)?.remove()
}

/**
 * Remove all composer UI (bubble, panel, highlight) from the rich root.
 * @param richRoot - The rich view root element.
 * @returns Nothing.
 */
function clearUi(richRoot: Element): void {
  removeBubble(richRoot)
  richRoot.querySelector(`[${COMPOSER_ATTR}]`)?.remove()
  clearSelectionHighlight(richRoot)
}
