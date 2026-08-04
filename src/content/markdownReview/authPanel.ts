import { RGM_STUB } from './selectors'

export const RGM_AUTH_PANEL = '[data-rgm-auth-panel]'

export type AuthPanelOptions = {
  userCode: string
  verificationUri: string
  onCancel: () => void
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

function appendParagraph(
  parent: HTMLElement,
  className: string,
  text: string,
): HTMLParagraphElement {
  const el = document.createElement('p')
  el.className = className
  el.textContent = text
  parent.appendChild(el)
  return el
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

  appendParagraph(
    panel,
    'rgm-auth-title',
    'Connect GitHub to use Rich Markdown view',
  )
  appendParagraph(
    panel,
    'rgm-auth-hint',
    'Enter this one-time code on GitHub. Then authorize Markdup.',
  )

  appendParagraph(panel, 'rgm-auth-code', options.userCode)

  const safety = document.createElement('div')
  safety.className = 'rgm-auth-safety'
  const safetyTitle = document.createElement('p')
  safetyTitle.className = 'rgm-auth-safety-title'
  safetyTitle.textContent = 'About this access'
  const list = document.createElement('ul')
  list.className = 'rgm-auth-safety-list'
  for (const item of [
    'Markdup stores the access token only in this browser.',
    'The token is not shared with other people or other computers.',
    'Markdup has no server that keeps your token.',
    'You can connect with GitHub (OAuth) or paste a personal access token in Markdup Settings.',
    'To revoke later: open Markdup Settings and click Remove from this browser.',
  ]) {
    const li = document.createElement('li')
    li.textContent = item
    list.appendChild(li)
  }
  safety.append(safetyTitle, list)
  panel.appendChild(safety)

  const actions = document.createElement('div')
  actions.className = 'rgm-auth-actions'

  const openBtn = document.createElement('button')
  openBtn.type = 'button'
  openBtn.className = 'rgm-auth-btn rgm-auth-btn-primary'
  openBtn.textContent = 'Open github.com/login/device'
  openBtn.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    window.open(options.verificationUri, '_blank', 'noopener,noreferrer')
  })

  const copyBtn = document.createElement('button')
  copyBtn.type = 'button'
  copyBtn.className = 'rgm-auth-btn'
  copyBtn.textContent = 'Copy code'
  copyBtn.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    void navigator.clipboard?.writeText(options.userCode).then(() => {
      copyBtn.textContent = 'Copied'
      window.setTimeout(() => {
        copyBtn.textContent = 'Copy code'
      }, 1500)
    })
  })

  const settingsBtn = document.createElement('button')
  settingsBtn.type = 'button'
  settingsBtn.className = 'rgm-auth-btn'
  settingsBtn.textContent = 'Use a personal access token…'
  settingsBtn.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    void chrome.runtime.openOptionsPage()
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
  error.hidden = true
  error.setAttribute('data-rgm-auth-error', '')

  actions.append(openBtn, copyBtn, settingsBtn, cancelBtn)
  panel.append(actions, error)

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
