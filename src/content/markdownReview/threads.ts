import type { RowModel } from '../../markdown/align'
import type { ReviewCommentDto, ReviewThreadDto } from '../../shared/messages'
import { getRichViewContext } from './selection'

/**
 * Insert or replace a thread built from a newly created review comment.
 * Used for optimistic UI before FETCH_THREAD_INDEX returns.
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
 * LEFT threads attach to Before; RIGHT to After.
 * Falls back to the nearest row when an exact block match is missing.
 */
export function renderThreadCards(richRoot: Element): void {
  clearThreadCards(richRoot)

  const ctx = getRichViewContext(richRoot)
  const threads = ctx?.threads ?? []
  if (threads.length === 0 || !ctx?.rows) {
    return
  }

  const body = richRoot.querySelector('.rgm-rich-body')
  if (!body) return

  const fileName = (ctx.path ?? '').split('/').pop() || ctx.path || 'file'

  for (const thread of threads) {
    const rowId = findRowIdForThread(ctx.rows, thread)
    const rowEl = rowId
      ? body.querySelector(`[data-row-id="${rowId}"]`)
      : null

    const card = buildThreadCard(thread, fileName)

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

    // Last resort: keep the thread visible at the bottom of the rich view.
    body.appendChild(card)
  }
}

export function clearThreadCards(richRoot: Element): void {
  richRoot.querySelectorAll('[data-rgm-thread-card]').forEach((el) => el.remove())
}

/** @internal Exported for tests. */
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

  // Closest block by line distance (outdated / gap lines).
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

/** @internal */
export function isReanchored(thread: ReviewThreadDto): boolean {
  const root = thread.comments[0]
  if (!root || root.originalLine == null) return false
  return root.originalLine !== thread.line
}

function buildThreadCard(
  thread: ReviewThreadDto,
  fileName: string,
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
  showBtn.textContent = 'Show'
  showBtn.setAttribute('aria-expanded', 'false')

  const detail = document.createElement('div')
  detail.className = 'rgm-thread-detail'
  detail.hidden = false

  const body = document.createElement('p')
  body.className = 'rgm-thread-body'
  body.textContent = root?.body ?? ''
  detail.appendChild(body)

  if (root?.htmlUrl) {
    const link = document.createElement('a')
    link.className = 'rgm-thread-link'
    link.href = root.htmlUrl
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    link.textContent = 'Open on GitHub'
    detail.appendChild(link)
  }

  if (thread.comments.length > 1) {
    const more = document.createElement('p')
    more.className = 'rgm-thread-more'
    more.textContent = `${thread.comments.length - 1} more ${
      thread.comments.length === 2 ? 'reply' : 'replies'
    }`
    detail.appendChild(more)
  }

  showBtn.textContent = 'Hide'
  showBtn.setAttribute('aria-expanded', 'true')
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

function initials(login: string): string {
  const clean = login.replace(/[^a-zA-Z0-9]/g, '')
  if (clean.length >= 2) return clean.slice(0, 2).toUpperCase()
  return (clean || '?').toUpperCase()
}

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
