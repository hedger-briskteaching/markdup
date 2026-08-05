import type { RowModel } from '../../markdown/align'
import {
  buildViewSections,
  findUnchangedSectionForRow,
} from '../../markdown/viewSections'
import type {
  ReviewCommentDto,
  ReviewThreadDto,
} from '../../shared/messages'
import {
  mountCommentEditor,
  type CommentEditorHandle,
} from './commentEditor'
import { markCommentsDirty } from './composer'
import { renderMarkdownBody } from './markdownBody'
import {
  applyThreadHoverHighlight,
  clearThreadHoverHighlight,
  getRichViewContext,
  isUnchangedSectionExpanded,
  paintCommentedMarks,
  type RichViewContext,
  type SourceRange,
} from './selection'
import { syncThreadsFromServer } from './syncThreads'

/**
 * Insert or replace a thread built from a newly created review comment.
 * Used for optimistic UI before FETCH_THREAD_INDEX returns.
 * @param threads - The current array of threads.
 * @param comment - The newly created comment DTO.
 * @param options - Optional flags (for example pending status).
 * @returns An updated thread array sorted by start line.
 */
export function upsertThreadFromComment(
  threads: ReviewThreadDto[],
  comment: ReviewCommentDto,
  options?: { pending?: boolean },
): ReviewThreadDto[] {
  const side = comment.side
  const line = comment.line ?? comment.originalLine
  if (!side || line == null) {
    return threads
  }

  const thread: ReviewThreadDto = {
    rootId: comment.id,
    path: comment.path,
    side,
    startLine: comment.startLine ?? line,
    line,
    comments: [comment],
    pending: options?.pending ?? true,
  }

  const without = threads.filter((t) => t.rootId !== thread.rootId)
  without.push(thread)
  without.sort((a, b) => {
    if (a.startLine !== b.startLine) return a.startLine - b.startLine
    return a.rootId - b.rootId
  })
  return without
}

/**
 * Render review thread cards under matching rich rows.
 * LEFT threads attach to Before cells. RIGHT threads attach to After cells.
 * @param richRoot - The rich view root element.
 * @returns Nothing.
 */
export function renderThreadCards(richRoot: Element): void {
  clearThreadCards(richRoot)

  const root = richRoot as HTMLElement
  const ctx = getRichViewContext(richRoot)
  const threads = ctx?.threads ?? []
  if (threads.length === 0 || !ctx?.rows) {
    paintCommentedMarks(root, [])
    return
  }

  const body = richRoot.querySelector('.rgm-rich-body')
  if (!body) return

  const fileName = (ctx.path ?? '').split('/').pop() || ctx.path || 'file'
  const sections = buildViewSections(ctx.rows)

  for (const thread of threads) {
    const rowId = findRowIdForThread(ctx.rows, thread)
    const rowEl = rowId
      ? body.querySelector(`[data-row-id="${rowId}"]`)
      : null

    if (!rowEl && rowId) {
      const section = findUnchangedSectionForRow(sections, rowId)
      if (section && !isUnchangedSectionExpanded(richRoot, section.id)) {
        continue
      }
    }

    const card = buildThreadCard(thread, fileName, root, ctx)
    attachHoverHighlight(card, root, rangeForThread(thread))

    if (rowEl) {
      const cell = rowEl.querySelector<HTMLElement>(
        `.rgm-rich-cell[data-side="${thread.side}"]`,
      )
      if (cell) {
        cell.appendChild(card)
        continue
      }
      rowEl.appendChild(card)
      continue
    }

    body.appendChild(card)
  }

  paintCommentedMarks(
    root,
    threads.map((thread) => ({
      threadId: thread.rootId,
      range: rangeForThread(thread),
    })),
  )
  bindThreadTextInteractions(root)
}

/**
 * Build the source range a thread targets (whole-line grain).
 * @internal Exported for tests.
 * @param thread - The review thread DTO.
 * @returns The source range for the thread.
 */
export function rangeForThread(thread: ReviewThreadDto): SourceRange {
  const endLine = thread.line
  const startLine = Math.min(thread.startLine ?? endLine, endLine)
  return {
    side: thread.side,
    startLine,
    startCol: 1,
    endLine,
    endCol: 1,
    quotedText: '',
  }
}

/**
 * Attach hover/focus highlight listeners to a thread card.
 * @param card - The thread card element.
 * @param richRoot - The rich view root element.
 * @param range - The source range to highlight on hover.
 * @returns Nothing.
 */
function attachHoverHighlight(
  card: HTMLElement,
  richRoot: HTMLElement,
  range: SourceRange,
): void {
  /**
   * Apply the hover highlight for this thread range.
   * @returns Nothing.
   */
  const show = () => applyThreadHoverHighlight(richRoot, range)
  /**
   * Clear the hover highlight for this thread range.
   * @returns Nothing.
   */
  const hide = () => clearThreadHoverHighlight(richRoot)
  card.addEventListener('mouseenter', show)
  card.addEventListener('mouseleave', hide)
  card.addEventListener('focusin', show)
  card.addEventListener('focusout', hide)
}

const textInteractionsBound = new WeakSet<Element>()

/**
 * Bind click-to-scroll interactions on commented text regions.
 * @param richRoot - The rich view root element.
 * @returns Nothing.
 */
function bindThreadTextInteractions(richRoot: HTMLElement): void {
  if (textInteractionsBound.has(richRoot)) return
  textInteractionsBound.add(richRoot)

  richRoot.addEventListener('click', (event) => {
    const selection = window.getSelection()
    if (selection && !selection.isCollapsed) return

    const target = event.target instanceof Element ? event.target : null
    if (
      !target ||
      target.closest(
        '[data-rgm-thread-card], [data-rgm-composer], [data-rgm-comment-bubble], [data-rgm-fold], .rgm-comment-editor',
      )
    ) {
      return
    }

    const threadId =
      threadIdAtPoint(richRoot, event) ?? threadIdFromFallbackCell(target)
    if (threadId == null) return
    scrollToThreadCard(richRoot, threadId)
  })
}

/**
 * Find the thread id of a commented mark box under the click point.
 * @param richRoot - The rich view root element.
 * @param event - The mouse event.
 * @returns The thread id string, or null if none found.
 */
function threadIdAtPoint(richRoot: Element, event: MouseEvent): string | null {
  const layer = richRoot.querySelector('[data-rgm-commented-layer]')
  if (!layer) return null
  for (const box of layer.querySelectorAll<HTMLElement>('[data-thread-id]')) {
    const rect = box.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) continue
    if (
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom
    ) {
      return box.getAttribute('data-thread-id')
    }
  }
  return null
}

/**
 * Fall back to the cell-level commented-thread attribute.
 * @param target - The clicked element.
 * @returns The thread id string, or null if none found.
 */
function threadIdFromFallbackCell(target: Element): string | null {
  return (
    target
      .closest('.rgm-commented-cell')
      ?.getAttribute('data-rgm-commented-thread') ?? null
  )
}

/**
 * Scroll to a thread card and flash it for visual attention.
 * @internal Exported for tests.
 * @param richRoot - The rich view root element.
 * @param threadId - The thread id to scroll to.
 * @returns Nothing.
 */
export function scrollToThreadCard(
  richRoot: Element,
  threadId: string,
): void {
  const card = richRoot.querySelector<HTMLElement>(
    `[data-rgm-thread-card][data-thread-id="${threadId}"]`,
  )
  if (!card) return

  const detail = card.querySelector<HTMLElement>('.rgm-thread-detail')
  if (detail?.hidden) {
    detail.hidden = false
    const show = card.querySelector<HTMLButtonElement>('.rgm-thread-show')
    if (show) {
      show.textContent = 'Hide'
      show.setAttribute('aria-expanded', 'true')
    }
  }

  card.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
  card.classList.add('rgm-thread-card-flash')
  window.setTimeout(() => {
    card.classList.remove('rgm-thread-card-flash')
  }, 1600)
}

/**
 * Remove all thread card elements from the rich root.
 * @param richRoot - The rich view root element.
 * @returns Nothing.
 */
export function clearThreadCards(richRoot: Element): void {
  richRoot.querySelectorAll('[data-rgm-thread-card]').forEach((el) => el.remove())
}

/**
 * Find the row id that best matches a thread by source line overlap.
 * @internal Exported for tests.
 * @param rows - All row models.
 * @param thread - The review thread DTO.
 * @returns The matching row id, or null if no match is found.
 */
export function findRowIdForThread(
  rows: RowModel[],
  thread: ReviewThreadDto,
): string | null {
  const lines = [thread.line, thread.startLine].filter(
    (n, i, arr) => Number.isFinite(n) && arr.indexOf(n) === i,
  )

  for (const row of rows) {
    const block = thread.side === 'LEFT' ? row.old : row.new
    if (!block || block.srcFrom == null || block.srcTo == null) {
      continue
    }
    for (const line of lines) {
      if (line >= block.srcFrom && line <= block.srcTo) {
        return row.id
      }
    }
  }

  let bestId: string | null = null
  let bestDist = Number.POSITIVE_INFINITY
  const target = thread.line
  for (const row of rows) {
    const block = thread.side === 'LEFT' ? row.old : row.new
    if (!block || block.srcFrom == null || block.srcTo == null) {
      continue
    }
    const dist =
      target < block.srcFrom
        ? block.srcFrom - target
        : target > block.srcTo
          ? target - block.srcTo
          : 0
    if (dist < bestDist) {
      bestDist = dist
      bestId = row.id
    }
  }
  return bestId
}

/**
 * Determine if a thread was re-anchored (source line moved since creation).
 * @internal Exported for tests.
 * @param thread - The review thread DTO.
 * @returns True when the thread is re-anchored.
 */
export function isReanchored(thread: ReviewThreadDto): boolean {
  const root = thread.comments[0]
  if (!root || root.originalLine == null) return false
  return root.originalLine !== thread.line
}

/**
 * Determine if a comment belongs to the current viewer.
 * @param comment - The comment DTO.
 * @param viewerLogin - The signed-in GitHub login.
 * @returns True when the comment was authored by the viewer.
 */
function isOwnComment(
  comment: ReviewCommentDto,
  viewerLogin: string | undefined,
): boolean {
  if (!viewerLogin || !comment.userLogin) return false
  return viewerLogin.toLowerCase() === comment.userLogin.toLowerCase()
}

/**
 * Build the full thread card element with header, detail, and footer.
 * @param thread - The review thread DTO.
 * @param fileName - The short file name for display.
 * @param richRoot - The rich view root element.
 * @param ctx - The rich view context.
 * @returns The thread card element.
 */
function buildThreadCard(
  thread: ReviewThreadDto,
  fileName: string,
  richRoot: HTMLElement,
  ctx: RichViewContext,
): HTMLElement {
  const root = thread.comments[0]
  const reanchored = isReanchored(thread)

  const card = document.createElement('div')
  card.setAttribute('data-rgm-thread-card', '')
  card.setAttribute('data-thread-id', String(thread.rootId))
  card.setAttribute('data-side', thread.side)
  card.className = 'rgm-thread-card'

  const bar = document.createElement('div')
  bar.className = 'rgm-thread-bar'

  const identity = document.createElement('div')
  identity.className = 'rgm-thread-identity'

  const avatar = document.createElement('span')
  avatar.className = 'rgm-thread-avatar'
  avatar.setAttribute('aria-hidden', 'true')
  avatar.textContent = initials(root?.userLogin ?? '?')

  const meta = document.createElement('div')
  meta.className = 'rgm-thread-meta'

  const who = document.createElement('span')
  who.className = 'rgm-thread-login'
  who.textContent = root?.userLogin || 'unknown'

  const when = document.createElement('span')
  when.className = 'rgm-thread-when'
  when.textContent = root?.createdAt
    ? formatRelativeTime(root.createdAt)
    : ''

  meta.append(who, when)
  identity.append(avatar, meta)

  const locus = document.createElement('div')
  locus.className = 'rgm-thread-locus'

  const pathPill = document.createElement('span')
  pathPill.className = 'rgm-thread-path'
  pathPill.textContent = formatPathLines(fileName, thread, reanchored)

  const chip = document.createElement('span')
  if (thread.pending) {
    chip.className = 'rgm-thread-chip rgm-thread-chip-pending'
    chip.textContent = 'Pending'
  } else if (reanchored) {
    chip.className = 'rgm-thread-chip rgm-thread-chip-reanchored'
    chip.textContent = 'Re-anchored — source moved'
  } else {
    chip.className = 'rgm-thread-chip rgm-thread-chip-open'
    chip.textContent = 'Open'
  }

  locus.append(pathPill, chip)

  const showBtn = document.createElement('button')
  showBtn.type = 'button'
  showBtn.className = 'rgm-thread-show'
  showBtn.textContent = 'Hide'
  showBtn.setAttribute('aria-expanded', 'true')

  const detail = document.createElement('div')
  detail.className = 'rgm-thread-detail'
  detail.hidden = false

  for (const comment of thread.comments) {
    detail.appendChild(
      buildCommentBlock(comment, richRoot, ctx),
    )
  }

  const replySlot = document.createElement('div')
  replySlot.className = 'rgm-thread-reply-slot'
  detail.appendChild(replySlot)

  const replyBtn = document.createElement('button')
  replyBtn.type = 'button'
  replyBtn.className = 'rgm-thread-action'
  replyBtn.textContent = 'Reply'
  replyBtn.addEventListener('click', () => {
    openReplyComposer(replySlot, thread, richRoot, ctx, replyBtn)
  })

  const footer = document.createElement('div')
  footer.className = 'rgm-thread-footer'

  const footerActions = document.createElement('div')
  footerActions.className = 'rgm-thread-footer-actions'
  footerActions.appendChild(replyBtn)

  if (root?.htmlUrl) {
    const sep = document.createElement('span')
    sep.className = 'rgm-thread-footer-sep'
    sep.setAttribute('aria-hidden', 'true')
    sep.textContent = '|'

    const link = document.createElement('a')
    link.className = 'rgm-thread-link'
    link.href = root.htmlUrl
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    link.textContent = 'Open on GitHub'
    footerActions.append(sep, link)
  }

  footer.appendChild(footerActions)
  detail.appendChild(footer)

  showBtn.addEventListener('click', () => {
    const open = detail.hidden
    detail.hidden = !open
    showBtn.textContent = open ? 'Hide' : 'Show'
    showBtn.setAttribute('aria-expanded', String(open))
  })

  bar.append(identity, locus, showBtn)
  card.append(bar, detail)
  return card
}

/**
 * Build a single comment block inside a thread card.
 * @param comment - The comment DTO.
 * @param richRoot - The rich view root element.
 * @param ctx - The rich view context.
 * @returns The comment block element.
 */
function buildCommentBlock(
  comment: ReviewCommentDto,
  richRoot: HTMLElement,
  ctx: RichViewContext,
): HTMLElement {
  const block = document.createElement('div')
  block.className = 'rgm-thread-comment'
  block.setAttribute('data-comment-id', String(comment.id))

  const head = document.createElement('div')
  head.className = 'rgm-thread-identity'

  const avatar = document.createElement('span')
  avatar.className = 'rgm-thread-avatar'
  avatar.setAttribute('aria-hidden', 'true')
  avatar.textContent = initials(comment.userLogin || '?')

  const meta = document.createElement('div')
  meta.className = 'rgm-thread-meta'
  const who = document.createElement('span')
  who.className = 'rgm-thread-login'
  who.textContent = comment.userLogin || 'unknown'
  const when = document.createElement('span')
  when.className = 'rgm-thread-when'
  when.textContent = formatRelativeTime(comment.createdAt)
  meta.append(who, when)
  head.append(avatar, meta)
  block.appendChild(head)

  const bodyHost = document.createElement('div')
  bodyHost.className = 'rgm-thread-body'
  bodyHost.appendChild(renderMarkdownBody(comment.body))
  block.appendChild(bodyHost)

  if (isOwnComment(comment, ctx.viewerLogin)) {
    const actions = document.createElement('div')
    actions.className = 'rgm-thread-comment-actions'

    const editBtn = document.createElement('button')
    editBtn.type = 'button'
    editBtn.className = 'rgm-thread-action'
    editBtn.textContent = 'Edit'
    editBtn.addEventListener('click', () => {
      openEditComposer(block, bodyHost, actions, comment, richRoot, ctx)
    })

    const deleteBtn = document.createElement('button')
    deleteBtn.type = 'button'
    deleteBtn.className = 'rgm-thread-action rgm-thread-action-danger'
    deleteBtn.textContent = 'Delete'
    deleteBtn.addEventListener('click', () => {
      void deleteComment(comment, richRoot, ctx, deleteBtn)
    })

    const sep = document.createElement('span')
    sep.className = 'rgm-thread-footer-sep'
    sep.setAttribute('aria-hidden', 'true')
    sep.textContent = '|'

    actions.append(editBtn, sep, deleteBtn)
    block.appendChild(actions)
  }

  return block
}

/**
 * Open the reply composer inside a thread card.
 * @param slot - The slot element to mount the reply into.
 * @param thread - The review thread DTO.
 * @param richRoot - The rich view root element.
 * @param ctx - The rich view context.
 * @param replyBtn - The Reply button to disable while composing.
 * @returns Nothing.
 */
function openReplyComposer(
  slot: HTMLElement,
  thread: ReviewThreadDto,
  richRoot: HTMLElement,
  ctx: RichViewContext,
  replyBtn: HTMLButtonElement,
): void {
  if (slot.querySelector('.rgm-thread-reply')) return
  replyBtn.disabled = true

  const panel = document.createElement('div')
  panel.className = 'rgm-thread-reply'

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
  submit.textContent = 'Reply'

  const cancel = document.createElement('button')
  cancel.type = 'button'
  cancel.className = 'rgm-composer-btn'
  cancel.textContent = 'Cancel'

  let editor: CommentEditorHandle | null = null
  /**
   * Close the reply panel and re-enable the reply button.
   * @returns Nothing.
   */
  const close = () => {
    editor?.destroy()
    panel.remove()
    replyBtn.disabled = false
  }

  cancel.addEventListener('click', close)
  submit.addEventListener('click', () => {
    void submitReply({
      editor,
      submit,
      status,
      thread,
      richRoot,
      ctx,
      onDone: close,
    })
  })

  actions.append(submit, cancel, status)
  panel.appendChild(actions)
  slot.appendChild(panel)

  editor = mountCommentEditor(editorHost, {
    placeholder: 'Reply…',
    onSubmit: () => submit.click(),
  })
  editor.focus()
}

/**
 * Submit a reply to an existing thread via the background script.
 * @param args - Editor, UI elements, thread, and context needed for submission.
 * @returns Nothing.
 */
async function submitReply(args: {
  editor: CommentEditorHandle | null
  submit: HTMLButtonElement
  status: HTMLElement
  thread: ReviewThreadDto
  richRoot: HTMLElement
  ctx: RichViewContext
  onDone: () => void
}): Promise<void> {
  const { editor, submit, status, thread, richRoot, ctx, onDone } = args
  const body = editor?.getMarkdown().trim() ?? ''
  if (!body) {
    status.hidden = false
    status.textContent = 'Write a reply first.'
    status.classList.add('rgm-composer-status-error')
    return
  }
  if (!ctx.owner || !ctx.repo || !ctx.pullNumber) return

  submit.disabled = true
  status.hidden = false
  status.classList.remove('rgm-composer-status-error')
  status.textContent = 'Posting…'

  const response = (await chrome.runtime.sendMessage({
    type: 'REPLY_REVIEW_COMMENT',
    owner: ctx.owner,
    repo: ctx.repo,
    pullNumber: ctx.pullNumber,
    inReplyToId: thread.rootId,
    body,
  })) as ReviewCommentDto | { error: string }

  if (response && 'error' in response) {
    submit.disabled = false
    status.textContent = response.error
    status.classList.add('rgm-composer-status-error')
    return
  }

  status.textContent = 'Syncing…'
  const synced = await syncThreadsFromServer(richRoot, ctx, {
    expectCommentId: response.id,
  })
  if (!synced.ok) {
    submit.disabled = false
    status.textContent = synced.error
    status.classList.add('rgm-composer-status-error')
    return
  }
  markCommentsDirty(richRoot)
  onDone()
}

/**
 * Open the edit composer for an existing comment.
 * @param block - The comment block element.
 * @param bodyHost - The comment body host element.
 * @param actions - The actions container element.
 * @param comment - The comment DTO.
 * @param richRoot - The rich view root element.
 * @param ctx - The rich view context.
 * @returns Nothing.
 */
function openEditComposer(
  block: HTMLElement,
  bodyHost: HTMLElement,
  actions: HTMLElement,
  comment: ReviewCommentDto,
  richRoot: HTMLElement,
  ctx: RichViewContext,
): void {
  if (block.querySelector('.rgm-thread-edit')) return

  bodyHost.hidden = true
  actions.hidden = true

  const panel = document.createElement('div')
  panel.className = 'rgm-thread-edit'
  const editorHost = document.createElement('div')
  panel.appendChild(editorHost)

  const row = document.createElement('div')
  row.className = 'rgm-composer-actions'
  const status = document.createElement('span')
  status.className = 'rgm-composer-status'
  status.hidden = true
  const save = document.createElement('button')
  save.type = 'button'
  save.className = 'rgm-composer-btn rgm-composer-btn-primary'
  save.textContent = 'Save'
  const cancel = document.createElement('button')
  cancel.type = 'button'
  cancel.className = 'rgm-composer-btn'
  cancel.textContent = 'Cancel'

  let editor: CommentEditorHandle | null = null
  /**
   * Close the edit panel and restore the comment body and actions.
   * @returns Nothing.
   */
  const close = () => {
    editor?.destroy()
    panel.remove()
    bodyHost.hidden = false
    actions.hidden = false
  }

  cancel.addEventListener('click', close)
  save.addEventListener('click', () => {
    void submitEdit({
      editor,
      save,
      status,
      comment,
      richRoot,
      ctx,
      bodyHost,
      onDone: close,
    })
  })

  row.append(save, cancel, status)
  panel.appendChild(row)
  block.appendChild(panel)

  editor = mountCommentEditor(editorHost, {
    initialMarkdown: comment.body,
    onSubmit: () => save.click(),
  })
  editor.focus()
}

/**
 * Submit an edited comment to GitHub via the background script.
 * @param args - Editor, UI elements, comment, and context needed for submission.
 * @returns Nothing.
 */
async function submitEdit(args: {
  editor: CommentEditorHandle | null
  save: HTMLButtonElement
  status: HTMLElement
  comment: ReviewCommentDto
  richRoot: HTMLElement
  ctx: RichViewContext
  bodyHost: HTMLElement
  onDone: () => void
}): Promise<void> {
  const { editor, save, status, comment, richRoot, ctx, bodyHost, onDone } =
    args
  const body = editor?.getMarkdown().trim() ?? ''
  if (!body) {
    status.hidden = false
    status.textContent = 'Comment cannot be empty.'
    status.classList.add('rgm-composer-status-error')
    return
  }
  if (!ctx.owner || !ctx.repo || !ctx.pullNumber) return

  save.disabled = true
  status.hidden = false
  status.classList.remove('rgm-composer-status-error')
  status.textContent = 'Saving…'

  const response = (await chrome.runtime.sendMessage({
    type: 'UPDATE_REVIEW_COMMENT',
    owner: ctx.owner,
    repo: ctx.repo,
    pullNumber: ctx.pullNumber,
    commentId: comment.id,
    body,
  })) as ReviewCommentDto | { error: string }

  if (response && 'error' in response) {
    save.disabled = false
    status.textContent = response.error
    status.classList.add('rgm-composer-status-error')
    return
  }

  status.textContent = 'Syncing…'
  const synced = await syncThreadsFromServer(richRoot, ctx)
  if (!synced.ok) {
    // Still update local body so the user is not stuck. Next sync will reconcile.
    bodyHost.replaceChildren(renderMarkdownBody(body))
    markCommentsDirty(richRoot)
    onDone()
    return
  }
  markCommentsDirty(richRoot)
  onDone()
}

/**
 * Delete a comment via the background script and re-sync threads.
 * @param comment - The comment DTO to delete.
 * @param richRoot - The rich view root element.
 * @param ctx - The rich view context.
 * @param button - The delete button to disable during the operation.
 * @returns Nothing.
 */
async function deleteComment(
  comment: ReviewCommentDto,
  richRoot: HTMLElement,
  ctx: RichViewContext,
  button: HTMLButtonElement,
): Promise<void> {
  if (!ctx.owner || !ctx.repo || !ctx.pullNumber) return
  if (!window.confirm('Delete this comment?')) return

  button.disabled = true
  const response = (await chrome.runtime.sendMessage({
    type: 'DELETE_REVIEW_COMMENT',
    owner: ctx.owner,
    repo: ctx.repo,
    pullNumber: ctx.pullNumber,
    commentId: comment.id,
  })) as { ok: true } | { error: string }

  if (response && 'error' in response) {
    button.disabled = false
    window.alert(response.error)
    return
  }

  const synced = await syncThreadsFromServer(richRoot, ctx)
  if (!synced.ok) {
    button.disabled = false
    window.alert(synced.error)
    return
  }
  markCommentsDirty(richRoot)
}

/**
 * Format the file path and line reference for a thread card header.
 * @param fileName - The short file name.
 * @param thread - The review thread DTO.
 * @param reanchored - True when the thread is re-anchored.
 * @returns The formatted path and line string.
 */
function formatPathLines(
  fileName: string,
  thread: ReviewThreadDto,
  reanchored: boolean,
): string {
  const root = thread.comments[0]
  if (reanchored && root?.originalLine != null) {
    return `${fileName} L${root.originalLine} → L${thread.line}`
  }
  if (thread.startLine !== thread.line) {
    return `${fileName} L${thread.startLine}–${thread.line}`
  }
  return `${fileName} L${thread.line}`
}

/**
 * Extract uppercase initials from a GitHub login.
 * @param login - The GitHub login string.
 * @returns One or two uppercase characters.
 */
function initials(login: string): string {
  const clean = login.replace(/[^a-zA-Z0-9]/g, '')
  if (clean.length >= 2) return clean.slice(0, 2).toUpperCase()
  return (clean || '?').toUpperCase()
}

/**
 * Format an ISO timestamp as a human-readable relative time string.
 * @param iso - The ISO 8601 timestamp.
 * @returns A relative time string like "5m ago" or "2 days ago".
 */
function formatRelativeTime(iso: string): string {
  const then = Date.parse(iso)
  if (!Number.isFinite(then)) return ''
  const seconds = Math.round((Date.now() - then) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
  const months = Math.round(days / 30)
  return `${months} mo ago`
}
