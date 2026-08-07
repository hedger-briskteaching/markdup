/**
 * Notice shown when GitHub's own page state no longer matches the review.
 *
 * Markdup creates and deletes review comments through the GitHub API, outside
 * the React app that renders the Files page. That app holds its own copy of the
 * review state — the pending comment count, the native inline threads, the
 * per-file counts — and never learns about our changes.
 *
 * A reload would fix it but costs scroll position, focus, and the rich view,
 * which is too much to spend on every comment. So first ask GitHub's own code
 * to refetch (see `nudgeGitHubRefetch`), and keep this notice as the fallback
 * for when that does not take.
 */

const NOTICE_ATTR = 'data-rgm-stale-notice'

/**
 * Ask GitHub's own page code to refetch its review state.
 *
 * We cannot call into that code: a content script runs in an isolated world,
 * so GitHub's store and router are out of reach. DOM events do cross that
 * boundary though, and data layers commonly refetch when the tab regains
 * focus or the network reconnects. Firing those events makes GitHub's code
 * refetch from GitHub's endpoints and re-render itself, which is a real
 * resync rather than us editing their markup.
 *
 * Whether it lands depends on how GitHub configured its queries, so treat
 * this as best effort. The stale notice stays up as the fallback.
 * @returns Nothing.
 */
export function nudgeGitHubRefetch(): void {
  try {
    // React Query and SWR both listen for these two.
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('focus'))
    // Refetch-on-reconnect, a second common default.
    window.dispatchEvent(new Event('online'))
  } catch {
    // Event construction is unavailable in some environments. The notice
    // still gives the reviewer a way forward.
  }
}

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
