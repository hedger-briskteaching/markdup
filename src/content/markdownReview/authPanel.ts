import { RGM_STUB } from './selectors'

export const RGM_AUTH_PANEL = '[data-rgm-auth-panel]'

export type AuthPanelOptions = {
  onCancel: () => void
  /** Optional error shown under the settings prompt. */
  errorMessage?: string
}

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

export function hideAuthPanel(region: Element): void {
  region.querySelector(RGM_AUTH_PANEL)?.remove()
}

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

export function setAuthPanelError(region: Element, message: string): void {
  const error = region.querySelector<HTMLElement>('[data-rgm-auth-error]')
  if (!error) {
    return
  }
  error.hidden = !message
  error.textContent = message
}
