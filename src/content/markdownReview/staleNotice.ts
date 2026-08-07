/**
 * Notice shown when GitHub's own page state no longer matches the review.
 *
 * Markdup creates and deletes review comments through the GitHub API, outside
 * the React app that renders the Files page. That app holds its own copy of the
 * review state — the pending comment count, the native inline threads, the
 * per-file counts — and never learns about our changes.
 *
 * A reload would fix it but costs scroll position, focus, and the rich view,
 * which is too much to spend on every comment. `toolbarSync` corrects the
 * counters in place instead; this notice is the fallback for when that fails,
 * and for the state it cannot reach.
 */

const NOTICE_ATTR = 'data-rgm-stale-notice'

/**
 * Show the stale-state notice at the top of the rich view.
 * Safe to call after every mutation: the notice is added only once.
 * @param richRoot - The rich view root element.
 * @returns Nothing.
 */
export function showStaleNotice(richRoot: Element): void {
  if (richRoot.querySelector(`[${NOTICE_ATTR}]`)) {
    return
  }

  const notice = document.createElement('div')
  notice.setAttribute(NOTICE_ATTR, '')
  // Chrome, so the text never counts toward source offsets or selections.
  notice.setAttribute('data-rgm-chrome', '')
  notice.className = 'rgm-stale-notice'
  notice.setAttribute('role', 'status')

  const text = document.createElement('span')
  text.className = 'rgm-stale-notice-text'
  text.textContent =
    "GitHub's review state on this page is from before your comment changes."

  const refresh = document.createElement('button')
  refresh.type = 'button'
  refresh.className = 'rgm-stale-notice-btn'
  refresh.textContent = 'Refresh page'
  // Rich mode is remembered per file path, so the view comes back after load.
  refresh.addEventListener('click', () => {
    window.location.reload()
  })

  notice.append(text, refresh)
  richRoot.prepend(notice)
}

/**
 * Remove the stale-state notice from the rich view.
 * @param richRoot - The rich view root element.
 * @returns Nothing.
 */
export function clearStaleNotice(richRoot: Element): void {
  richRoot.querySelector(`[${NOTICE_ATTR}]`)?.remove()
}
