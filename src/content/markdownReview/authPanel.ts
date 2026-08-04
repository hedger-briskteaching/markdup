import { RGM_STUB } from './selectors'

export const RGM_AUTH_PANEL = '[data-rgm-auth-panel]'

export type AuthPanelOptions = {
  onCancel: () => void
  /** Optional error message shown under the configuration prompt. */
  errorMessage?: string
}

/**
 * Find the DOM element that the auth panel will mount into.
 * @param region - The file region element.
 * @returns The mount point element, or null if not found.
 */
function findMountPoint(region: Element): HTMLElement | null {
  const stub = region.querySelector(RGM_STUB)
  if (stub?.parentElement) {
    return stub.parentElement
  }

  const header = region.querySelector('[data-diff-header-wrapper]')
  if (header?.parentElement === region) {
    return region as HTMLElement
  }

  return region instanceof HTMLElement ? region : null
}

/**
 * Remove the auth panel from a file region if present.
 * @param region - The file region element.
 * @returns Nothing.
 */
export function hideAuthPanel(region: Element): void {
  region.querySelector(RGM_AUTH_PANEL)?.remove()
}

/**
 * Build and show the authentication panel inside a file region.
 * @param region - The file region element.
 * @param options - Callbacks and optional error message.
 * @returns The created panel element.
 */
export function showAuthPanel(
  region: Element,
  options: AuthPanelOptions,
): HTMLElement {
  hideAuthPanel(region)

  const panel = document.createElement('div')
  panel.setAttribute('data-rgm-auth-panel', '')
  panel.setAttribute('role', 'dialog')
  panel.setAttribute('aria-label', 'Connect GitHub')

  const title = document.createElement('p')
  title.className = 'rgm-auth-title'
  title.textContent = 'Connect GitHub to use Markdup'

  const hint = document.createElement('p')
  hint.className = 'rgm-auth-hint'
  hint.textContent =
    'Open Markdup Settings to connect with GitHub or paste a personal access token.'

  const actions = document.createElement('div')
  actions.className = 'rgm-auth-actions'

  const settingsBtn = document.createElement('button')
  settingsBtn.type = 'button'
  settingsBtn.className = 'rgm-auth-btn rgm-auth-btn-primary'
  settingsBtn.textContent = 'Open Settings'
  settingsBtn.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    void chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS' })
  })

  const cancelBtn = document.createElement('button')
  cancelBtn.type = 'button'
  cancelBtn.className = 'rgm-auth-btn'
  cancelBtn.textContent = 'Cancel'
  cancelBtn.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    options.onCancel()
  })

  const error = document.createElement('p')
  error.className = 'rgm-auth-error'
  error.setAttribute('data-rgm-auth-error', '')
  if (options.errorMessage) {
    error.textContent = options.errorMessage
  } else {
    error.hidden = true
  }

  actions.append(settingsBtn, cancelBtn)
  panel.append(title, hint, actions, error)

  const mount = findMountPoint(region)
  const stub = region.querySelector(RGM_STUB)
  if (stub) {
    stub.before(panel)
  } else if (mount) {
    const header = region.querySelector('[data-diff-header-wrapper]')
    if (header?.nextElementSibling) {
      header.after(panel)
    } else {
      mount.appendChild(panel)
    }
  }

  return panel
}

/**
 * Show or clear an error message on an existing auth panel.
 * @param region - The file region element containing the panel.
 * @param message - Error text to show. Empty string hides the error.
 * @returns Nothing.
 */
export function setAuthPanelError(region: Element, message: string): void {
  const error = region.querySelector<HTMLElement>('[data-rgm-auth-error]')
  if (!error) {
    return
  }
  error.hidden = !message
  error.textContent = message
}
