import type {
  AuthEnsureResponse,
  ExtensionEvent,
} from '../../shared/messages'
import {
  hideAuthPanel,
  setAuthPanelError,
  showAuthPanel,
} from './authPanel'
import { isRichMode, setRichMode } from './richStub'
import {
  DIFF_HEADER_WRAPPER,
  FILE_VIEW_SEGMENTED,
  HEADER_ACTIONS,
  KEBAB_ICON,
  RGM_TOGGLE,
} from './selectors'

const LABEL_TEXT = 'Rich Markdown view'

const TOOLTIP_OFF =
  'Rich Markdown view is off — showing the source diff. Turn on to preview rendered markdown.'
const TOOLTIP_ON =
  'Rich Markdown view is on — showing rendered markdown. Turn off to return to the source diff.'

const pendingRegions = new Set<Element>()

function findKebabButton(region: Element): HTMLElement | null {
  const header = region.querySelector(DIFF_HEADER_WRAPPER) ?? region
  const buttons = header.querySelectorAll<HTMLElement>('button')
  for (const button of buttons) {
    if (button.querySelector(KEBAB_ICON)) {
      return button
    }
    const label = (
      button.getAttribute('aria-label') ??
      button.getAttribute('aria-labelledby') ??
      ''
    ).toLowerCase()
    if (label.includes('more options')) {
      return button
    }
  }
  return null
}

function findActionsContainer(region: Element): HTMLElement | null {
  const kebab = findKebabButton(region)
  if (kebab?.parentElement) {
    return kebab.parentElement
  }

  const header = region.querySelector(DIFF_HEADER_WRAPPER) ?? region
  return header.querySelector<HTMLElement>(HEADER_ACTIONS)
}

function findNativeFileViewToggle(region: Element): HTMLElement | null {
  const header = region.querySelector(DIFF_HEADER_WRAPPER) ?? region
  return header.querySelector<HTMLElement>(FILE_VIEW_SEGMENTED)
}

function hideNativeFileViewToggle(native: HTMLElement): void {
  native.setAttribute('data-rgm-native-hidden', '')
  native.setAttribute('hidden', '')
  native.setAttribute('aria-hidden', 'true')
}

function syncToggleState(toggle: HTMLElement, rich: boolean): void {
  toggle.setAttribute('data-rgm-mode', rich ? 'rich' : 'source')
  toggle.setAttribute('title', rich ? TOOLTIP_ON : TOOLTIP_OFF)

  const switchBtn = toggle.querySelector<HTMLButtonElement>('[role="switch"]')
  if (switchBtn) {
    switchBtn.setAttribute('aria-checked', String(rich))
    switchBtn.setAttribute('title', rich ? TOOLTIP_ON : TOOLTIP_OFF)
  }
}

function sendEnsureAuth(): Promise<AuthEnsureResponse> {
  return chrome.runtime.sendMessage({ type: 'AUTH_ENSURE' }) as Promise<AuthEnsureResponse>
}

function enableRich(region: Element, toggle: HTMLElement): void {
  pendingRegions.delete(region)
  hideAuthPanel(region)
  setRichMode(region, true)
  syncToggleState(toggle, true)
}

function cancelAuth(region: Element, toggle: HTMLElement): void {
  pendingRegions.delete(region)
  hideAuthPanel(region)
  void chrome.runtime.sendMessage({ type: 'AUTH_CANCEL' })
  setRichMode(region, false)
  syncToggleState(toggle, false)
}

function beginAuth(region: Element, toggle: HTMLElement): void {
  pendingRegions.add(region)
  syncToggleState(toggle, false)

  void sendEnsureAuth().then((response) => {
    if (!pendingRegions.has(region) && response.status !== 'ok') {
      return
    }

    if (response.status === 'ok') {
      enableRich(region, toggle)
      return
    }

    if (response.status === 'error') {
      pendingRegions.add(region)
      showAuthPanel(region, {
        userCode: '—',
        verificationUri: 'https://github.com/login/device',
        onCancel: () => cancelAuth(region, toggle),
      })
      setAuthPanelError(region, response.message)
      syncToggleState(toggle, false)
      return
    }

    pendingRegions.add(region)
    showAuthPanel(region, {
      userCode: response.user_code,
      verificationUri: response.verification_uri,
      onCancel: () => cancelAuth(region, toggle),
    })
    syncToggleState(toggle, false)
  })
}

function createToggleControl(path: string, region: Element): HTMLElement {
  const toggle = document.createElement('div')
  toggle.setAttribute('data-rgm-toggle', '')
  toggle.setAttribute('data-rgm-file', path)

  const switchBtn = document.createElement('button')
  switchBtn.type = 'button'
  switchBtn.setAttribute('role', 'switch')
  switchBtn.setAttribute('aria-label', LABEL_TEXT)
  switchBtn.className = 'rgm-switch'

  const track = document.createElement('span')
  track.className = 'rgm-switch-track'
  track.setAttribute('aria-hidden', 'true')

  const thumb = document.createElement('span')
  thumb.className = 'rgm-switch-thumb'
  track.appendChild(thumb)
  switchBtn.appendChild(track)

  const label = document.createElement('span')
  label.className = 'rgm-switch-label'
  label.textContent = LABEL_TEXT

  toggle.appendChild(switchBtn)
  toggle.appendChild(label)

  syncToggleState(toggle, isRichMode(region))

  const onActivate = (event: Event) => {
    event.preventDefault()
    event.stopPropagation()

    if (isRichMode(region) || pendingRegions.has(region)) {
      cancelAuth(region, toggle)
      return
    }

    beginAuth(region, toggle)
  }

  switchBtn.addEventListener('click', onActivate)
  label.addEventListener('click', onActivate)

  return toggle
}

function placeToggle(
  region: Element,
  toggle: HTMLElement,
  native: HTMLElement | null,
): void {
  if (native) {
    hideNativeFileViewToggle(native)
    native.after(toggle)
    return
  }

  const kebab = findKebabButton(region)
  if (kebab) {
    kebab.before(toggle)
    return
  }

  const actions = findActionsContainer(region)
  if (actions) {
    actions.appendChild(toggle)
  }
}

function onAuthEvent(message: ExtensionEvent): void {
  if (message.type === 'AUTH_COMPLETE') {
    for (const region of [...pendingRegions]) {
      const toggle = region.querySelector<HTMLElement>(RGM_TOGGLE)
      if (toggle) {
        enableRich(region, toggle)
      } else {
        pendingRegions.delete(region)
      }
    }
    return
  }

  if (message.type === 'AUTH_ERROR') {
    for (const region of pendingRegions) {
      setAuthPanelError(region, message.message)
      const toggle = region.querySelector<HTMLElement>(RGM_TOGGLE)
      if (toggle) {
        syncToggleState(toggle, false)
      }
    }
  }
}

let authListenerAttached = false

function ensureAuthListener(): void {
  if (authListenerAttached) {
    return
  }
  if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) {
    return
  }
  authListenerAttached = true
  chrome.runtime.onMessage.addListener((message: ExtensionEvent) => {
    if (message?.type === 'AUTH_COMPLETE' || message?.type === 'AUTH_ERROR') {
      onAuthEvent(message)
    }
  })
}

/** @internal Vitest helper — resets the one-shot runtime listener flag. */
export function resetAuthListenerForTests(): void {
  authListenerAttached = false
  pendingRegions.clear()
}

/** Inject Rich Markdown view switch for a markdown file region. Idempotent. */
export function injectToggle(region: Element, path: string): void {
  ensureAuthListener()

  if (region.querySelector(RGM_TOGGLE)) {
    return
  }

  const native = findNativeFileViewToggle(region)
  const toggle = createToggleControl(path, region)
  placeToggle(region, toggle, native)
}
