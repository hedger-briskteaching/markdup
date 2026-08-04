import type {
  AuthEnsureResponse,
  AuthStatusResponse,
  ExtensionEvent,
  ExtensionRequest,
  FileSnapshot,
} from '../shared/messages'
import {
  cancelDevicePoll,
  clearAccessToken,
  getAccessToken,
  getActiveDeviceCode,
  getStoredLogin,
  runDevicePollAndStore,
  startDeviceFlow,
  validateToken,
} from './github/auth'
import { fetchFileSnapshot } from './github/contents'

async function broadcast(event: ExtensionEvent): Promise<void> {
  const tabs = await chrome.tabs.query({ url: ['https://github.com/*'] })
  await Promise.all(
    tabs.map(async (tab) => {
      if (tab.id == null) {
        return
      }
      try {
        await chrome.tabs.sendMessage(tab.id, event)
      } catch {
        // Tab may not have the content script.
      }
    }),
  )

  try {
    await chrome.runtime.sendMessage(event)
  } catch {
    // No extension page listening (popup closed).
  }
}

async function ensureAuth(): Promise<AuthEnsureResponse> {
  const existing = await getAccessToken()
  if (existing) {
    const user = await validateToken(existing)
    if (user) {
      return { status: 'ok', login: user.login }
    }
    await clearAccessToken()
  }

  const active = getActiveDeviceCode()
  if (active) {
    return {
      status: 'needs_auth',
      user_code: active.user_code,
      verification_uri: active.verification_uri,
      expires_in: active.expires_in,
    }
  }

  try {
    const device = await startDeviceFlow()
    void runDevicePollAndStore(device)
      .then(async (auth) => {
        await broadcast({ type: 'AUTH_COMPLETE', login: auth.login })
      })
      .catch(async (error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
        const message =
          error instanceof Error ? error.message : 'GitHub authorization failed'
        await broadcast({ type: 'AUTH_ERROR', message })
      })

    return {
      status: 'needs_auth',
      user_code: device.user_code,
      verification_uri: device.verification_uri,
      expires_in: device.expires_in,
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to start GitHub Connect'
    return { status: 'error', message }
  }
}

async function authStatus(): Promise<AuthStatusResponse> {
  const token = await getAccessToken()
  if (!token) {
    return { authenticated: false }
  }
  const login = (await getStoredLogin()) ?? undefined
  const user = await validateToken(token)
  if (!user) {
    await clearAccessToken()
    return { authenticated: false }
  }
  return { authenticated: true, login: user.login ?? login }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const request = message as ExtensionRequest

  if (request?.type === 'AUTH_ENSURE') {
    void ensureAuth().then(sendResponse)
    return true
  }

  if (request?.type === 'AUTH_STATUS') {
    void authStatus().then(sendResponse)
    return true
  }

  if (request?.type === 'AUTH_CANCEL') {
    cancelDevicePoll()
    sendResponse({ ok: true })
    return false
  }

  if (request?.type === 'AUTH_DISCONNECT') {
    void clearAccessToken().then(() => sendResponse({ ok: true }))
    return true
  }

  if (request?.type === 'FETCH_FILE_SNAPSHOT') {
    void fetchFileSnapshot(
      request.owner,
      request.repo,
      request.pullNumber,
      request.path,
    )
      .then((snapshot: FileSnapshot) => sendResponse(snapshot))
      .catch((error: unknown) => {
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to load the Markdown file'
        sendResponse({ error: message })
      })
    return true
  }

  return false
})

console.debug('[Markdup] background service worker ready')
