/** Storage key marking that the Markdup toggle NUX has been shown. */
export const NUX_TOGGLE_VISITED_KEY = 'nux.markdupToggleVisited'

const NUX_SELECTOR = '[data-rgm-nux]'

const NUX_MESSAGE =
  'Use this toggle to review markdown files in rich text format.'

/** True once this page has claimed the NUX slot (shown or skipped). */
let nuxClaimed = false

/**
 * Read whether the toggle NUX has already been visited.
 * @returns True when storage says the NUX was already shown.
 */
async function hasVisitedToggleNux(): Promise<boolean> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return true
  }
  const result = await chrome.storage.local.get(NUX_TOGGLE_VISITED_KEY)
  return Boolean(result[NUX_TOGGLE_VISITED_KEY])
}

/**
 * Persist that the toggle NUX has been visited so it never shows again.
 * @returns Nothing.
 */
async function markToggleNuxVisited(): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return
  }
  await chrome.storage.local.set({ [NUX_TOGGLE_VISITED_KEY]: true })
}

/**
 * Remove any open Markdup NUX popup from the document.
 * @returns Nothing.
 */
export function dismissToggleNux(): void {
  document.querySelector(NUX_SELECTOR)?.remove()
}

/**
 * Build and attach the one-time NUX popup under a toggle.
 * @param toggle - The Markdup toggle element to point at.
 * @returns The created popup element.
 */
function showToggleNux(toggle: HTMLElement): HTMLElement {
  dismissToggleNux()

  const popup = document.createElement('div')
  popup.setAttribute('data-rgm-nux', '')
  popup.setAttribute('role', 'status')
  popup.setAttribute('aria-live', 'polite')

  const arrow = document.createElement('span')
  arrow.className = 'rgm-nux-arrow'
  arrow.setAttribute('aria-hidden', 'true')

  const body = document.createElement('div')
  body.className = 'rgm-nux-body'

  const message = document.createElement('p')
  message.className = 'rgm-nux-message'
  message.textContent = NUX_MESSAGE

  const dismissBtn = document.createElement('button')
  dismissBtn.type = 'button'
  dismissBtn.className = 'rgm-nux-dismiss'
  dismissBtn.textContent = 'Got it'
  dismissBtn.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    dismissToggleNux()
  })

  body.appendChild(message)
  body.appendChild(dismissBtn)
  popup.appendChild(arrow)
  popup.appendChild(body)
  toggle.appendChild(popup)

  return popup
}

/**
 * Show the Markdup toggle NUX on the first eligible mount, once ever.
 * Concurrent callers after the first are ignored. Already-visited users skip.
 * @param toggle - The newly mounted Markdup toggle element.
 * @returns A promise that settles when the NUX decision is complete.
 */
export async function maybeShowToggleNux(toggle: HTMLElement): Promise<void> {
  if (nuxClaimed) {
    return
  }
  if (document.querySelector(NUX_SELECTOR)) {
    nuxClaimed = true
    return
  }

  nuxClaimed = true

  try {
    if (await hasVisitedToggleNux()) {
      return
    }

    // Toggle may have been removed while storage was resolving.
    if (!toggle.isConnected) {
      nuxClaimed = false
      return
    }

    showToggleNux(toggle)
    await markToggleNuxVisited()
  } catch {
    // Allow a later mount to retry if storage failed before showing.
    nuxClaimed = false
  }
}

/**
 * Reset NUX in-memory state for unit tests.
 * @internal Vitest helper.
 * @returns Nothing.
 */
export function resetToggleNuxForTests(): void {
  nuxClaimed = false
  dismissToggleNux()
}
