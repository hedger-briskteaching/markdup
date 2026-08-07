/**
 * Follow GitHub's review-comment links into the rich view.
 *
 * "Jump to the comment in the diff" sets a `#r<commentId>` hash and lets the
 * browser scroll to the matching element in the native diff. Rich mode hides
 * that diff, so the anchor resolves to something invisible and the page does
 * not move. The comment is on screen, just in one of our thread cards.
 *
 * Map the hash onto that card instead. The id in the hash is a comment, which
 * may be a reply, so resolve it through the card that holds it rather than
 * assuming it names a thread.
 */

import { scrollToThreadCard } from './threadFocus'

/** GitHub review comment anchors look like `#r123456789`. */
const COMMENT_HASH = /^#r(\d+)$/

/**
 * Thread cards are rendered after the file snapshot and thread index load,
 * so a hash present at page load usually arrives before them.
 */
const ATTEMPTS = 12
const RETRY_DELAY_MS = 250

let bound = false
let pending = 0

/**
 * Read the comment id out of a URL hash.
 * @param hash - The location hash, including the leading `#`.
 * @returns The comment id, or null when the hash is not a comment anchor.
 */
export function commentIdFromHash(hash: string): string | null {
  return COMMENT_HASH.exec(hash)?.[1] ?? null
}

/**
 * Scroll the rich view to the comment named by a hash.
 * @param hash - The location hash, including the leading `#`.
 * @returns True when a matching card was found and scrolled to.
 */
export function focusCommentFromHash(hash: string): boolean {
  const commentId = commentIdFromHash(hash)
  if (!commentId) return false

  // The hash can name a reply, so find the card that contains the comment
  // and scroll to the card as a whole. The id is digits only, per the
  // pattern above, so it is safe to drop straight into a selector.
  const comment = document.querySelector(
    `[data-rgm-rich] [data-comment-id="${commentId}"]`,
  )
  const card = comment?.closest<HTMLElement>('[data-rgm-thread-card]')
  const threadId = card?.getAttribute('data-thread-id')
  const richRoot = card?.closest('[data-rgm-rich]')
  if (!card || !threadId || !richRoot) return false

  scrollToThreadCard(richRoot, threadId)
  return true
}

/**
 * Try to follow the current hash, retrying while the rich view loads.
 * @returns Nothing.
 */
export function followCommentHash(): void {
  if (!commentIdFromHash(location.hash)) return

  const attempt = ++pending
  let tries = 0

  /**
   * Retry until the card exists, the attempts run out, or a newer hash wins.
   * @returns Nothing.
   */
  const run = (): void => {
    // A newer navigation started, so abandon this one.
    if (attempt !== pending) return
    if (focusCommentFromHash(location.hash)) return
    if (++tries >= ATTEMPTS) return
    window.setTimeout(run, RETRY_DELAY_MS)
  }

  run()
}

/**
 * Listen for comment anchors and follow them into the rich view.
 * Safe to call more than once.
 * @returns Nothing.
 */
export function bindCommentAnchor(): void {
  if (bound) return
  bound = true
  window.addEventListener('hashchange', followCommentHash)
  followCommentHash()
}

/**
 * Reset module state so tests can bind again.
 * @returns Nothing.
 */
export function resetCommentAnchorForTests(): void {
  window.removeEventListener('hashchange', followCommentHash)
  bound = false
  pending = 0
}
