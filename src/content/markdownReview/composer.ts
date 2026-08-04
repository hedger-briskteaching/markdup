import { createPayloadFromRange } from '../../shared/reviewComment'
import type { SourceRange } from '../../markdown/sourceRange'
import type { ReviewCommentDto } from '../../shared/messages'
import {
  getRichViewContext,
  selectionToSourceRange,
  type RichViewContext,
} from './selection'

const COMPOSER_ATTR = 'data-rgm-composer'

/**
 * Listen for selections inside a rich root and show a create-comment composer.
 */
export function bindComposer(richRoot: HTMLElement): () => void {
  const onMouseUp = () => {
    window.setTimeout(() => {
      maybeOpenComposer(richRoot)
    }, 0)
  }

  richRoot.addEventListener('mouseup', onMouseUp)
  return () => {
    richRoot.removeEventListener('mouseup', onMouseUp)
    richRoot.querySelector(`[${COMPOSER_ATTR}]`)?.remove()
  }
}

function maybeOpenComposer(richRoot: HTMLElement): void {
  const selection = window.getSelection()
  if (!selection) {
    return
  }

  const range = selectionToSourceRange(selection, richRoot)
  if (!range) {
    return
  }

  const ctx = getRichViewContext(richRoot)
  if (!ctx?.owner || !ctx.repo || !ctx.pullNumber || !ctx.path) {
    return
  }

  showComposer(richRoot, range, ctx)
}

function showComposer(
  richRoot: HTMLElement,
  range: SourceRange,
  ctx: RichViewContext,
): void {
  richRoot.querySelector(`[${COMPOSER_ATTR}]`)?.remove()

  const panel = document.createElement('div')
  panel.setAttribute(COMPOSER_ATTR, '')
  panel.className = 'rgm-composer'

  const meta = document.createElement('p')
  meta.className = 'rgm-composer-meta'
  meta.textContent = formatRangeMeta(range)
  panel.appendChild(meta)

  if (range.quotedText) {
    const quote = document.createElement('blockquote')
    quote.className = 'rgm-composer-quote'
    quote.textContent = range.quotedText
    panel.appendChild(quote)
  }

  const textarea = document.createElement('textarea')
  textarea.className = 'rgm-composer-input'
  textarea.rows = 3
  textarea.placeholder = 'Leave a review comment'
  panel.appendChild(textarea)

  const actions = document.createElement('div')
  actions.className = 'rgm-composer-actions'

  const status = document.createElement('span')
  status.className = 'rgm-composer-status'
  status.hidden = true

  const cancel = document.createElement('button')
  cancel.type = 'button'
  cancel.className = 'rgm-composer-btn rgm-composer-btn-secondary'
  cancel.textContent = 'Cancel'
  cancel.addEventListener('click', () => panel.remove())

  const submit = document.createElement('button')
  submit.type = 'button'
  submit.className = 'rgm-composer-btn rgm-composer-btn-primary'
  submit.textContent = 'Comment'

  submit.addEventListener('click', () => {
    void submitComment({
      panel,
      textarea,
      submit,
      status,
      range,
      ctx,
    })
  })

  actions.appendChild(status)
  actions.appendChild(cancel)
  actions.appendChild(submit)
  panel.appendChild(actions)

  const cell = richRoot.querySelector(
    `.rgm-rich-cell[data-side="${range.side}"]`,
  )
  const row = cell?.closest('.rgm-rich-row')
  if (row) {
    row.after(panel)
  } else {
    richRoot.appendChild(panel)
  }

  textarea.focus()
}

async function submitComment(args: {
  panel: HTMLElement
  textarea: HTMLTextAreaElement
  submit: HTMLButtonElement
  status: HTMLElement
  range: SourceRange
  ctx: RichViewContext
}): Promise<void> {
  const { panel, textarea, submit, status, range, ctx } = args
  const body = textarea.value.trim()
  if (!body) {
    status.hidden = false
    status.textContent = 'Write a comment first.'
    status.classList.add('rgm-composer-status-error')
    return
  }

  if (!ctx.owner || !ctx.repo || !ctx.pullNumber || !ctx.path) {
    return
  }

  const commitId =
    range.side === 'LEFT' ? ctx.baseSha || ctx.headSha : ctx.headSha
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

  status.textContent = 'Comment posted.'
  window.setTimeout(() => panel.remove(), 600)
}

function formatRangeMeta(range: SourceRange): string {
  const side = range.side === 'LEFT' ? 'Before' : 'After'
  if (range.startLine === range.endLine) {
    return `${side} · line ${range.startLine}`
  }
  return `${side} · lines ${range.startLine}–${range.endLine}`
}
