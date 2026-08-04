import type {
  AuthEnsureResponse,
  AuthSetPatResponse,
  AuthStatusResponse,
  ExtensionEvent,
  ExtensionRequest,
  FileSnapshot,
  ReviewCommentDto,
  ThreadIndexDto,
} from '../shared/messages'
import {
  formatOrgOauthRestrictionRichError,
  isOrgOauthRestrictionError,
  parseOrgFromOauthRestriction,
} from '../shared/oauthRestriction'
import {
  cancelDevicePoll,
  clearAccessToken,
  getAccessToken,
  getActiveDeviceCode,
  getAuthMethod,
  getStoredLogin,
  runDevicePollAndStore,
  setPersonalAccessToken,
  startDeviceFlow,
  validateToken,
} from './github/auth'
import { fetchFileSnapshot } from './github/contents'
import {
  getAccessWarning,
  probeOauthOrgAccess,
  recordApiAccessWarning,
  setAccessWarning,
} from './github/orgAccess'
import { createReviewComment, fetchThreadIndex, replyToReviewComment, updateReviewComment, deleteReviewComment } from './github/pulls'

/**
 * Send an event to all open GitHub PR tabs and the extension runtime.
 * @param event - The extension event payload to broadcast.
 */
async function broadcast(event: ExtensionEvent): Promise<void> {
  const tabs = await chrome.tabs.query({ url: ['https://github.com/*/pull/*'] })
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

/**
 * Probe organization access and persist the result as an access warning.
 * @param token - GitHub access token to probe with.
 */
async function refreshOauthAccessWarning(token: string): Promise<void> {
  const warning = await probeOauthOrgAccess(token)
  await setAccessWarning(warning)
}

/**
 * Make sure the user is authenticated, starting a device flow if needed.
 * @returns An AuthEnsureResponse indicating current auth state.
 */
async function ensureAuth(): Promise<AuthEnsureResponse> {
  const existing = await getAccessToken()
  if (existing) {
    const user = await validateToken(existing)
    if (user) {
      const method = await getAuthMethod()
      if (method === 'pat') {
        await setAccessWarning(null)
      }
      return { status: 'ok', login: user.login }
    }
    await clearAccessToken()
    await setAccessWarning(null)
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
        await refreshOauthAccessWarning(auth.token)
        const accessWarning = await getAccessWarning()
        await broadcast({
          type: 'AUTH_COMPLETE',
          login: auth.login,
          method: auth.method,
          accessWarning,
        })
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

/**
 * Return the current authentication status and optionally re-probe org access.
 * @param probe - When true, re-run the OAuth org access probe.
 * @returns An AuthStatusResponse with login, method, and access warning.
 */
async function authStatus(
  probe = false,
): Promise<AuthStatusResponse> {
  const token = await getAccessToken()
  if (!token) {
    return { authenticated: false }
  }
  const login = (await getStoredLogin()) ?? undefined
  const method = (await getAuthMethod()) ?? undefined
  const user = await validateToken(token)
  if (!user) {
    await clearAccessToken()
    await setAccessWarning(null)
    return { authenticated: false }
  }

  if (method === 'pat') {
    await setAccessWarning(null)
    return {
      authenticated: true,
      login: user.login ?? login,
      method,
      accessWarning: null,
    }
  }

  if (method === 'oauth' && probe) {
    await refreshOauthAccessWarning(token)
  }

  return {
    authenticated: true,
    login: user.login ?? login,
    method,
    accessWarning: await getAccessWarning(),
  }
}

/**
 * Validate and store a personal access token provided by the user.
 * @param token - Raw PAT string to validate.
 * @returns An AuthSetPatResponse with status and login on success.
 */
async function authSetPat(token: string): Promise<AuthSetPatResponse> {
  try {
    const auth = await setPersonalAccessToken(token)
    await setAccessWarning(null)
    await broadcast({
      type: 'AUTH_COMPLETE',
      login: auth.login,
      method: auth.method,
      accessWarning: null,
    })
    return { status: 'ok', login: auth.login }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Markdup could not save the personal access token.'
    return { status: 'error', message }
  }
}

/**
 * Format a caught API error into a user-facing message.
 * Records an access warning if the error is an OAuth org restriction.
 * @param error - The caught error value.
 * @param fallback - Fallback message when the error is not an Error instance.
 * @returns A formatted error string for display.
 */
function formatCaughtApiError(error: unknown, fallback: string): string {
  const raw =
    error instanceof Error ? error.message : fallback
  if (isOrgOauthRestrictionError(raw)) {
    const org = parseOrgFromOauthRestriction(raw) ?? undefined
    void recordApiAccessWarning(raw)
    return formatOrgOauthRestrictionRichError(org)
  }
  return raw
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const request = message as ExtensionRequest

  if (request?.type === 'AUTH_ENSURE') {
    void ensureAuth().then(sendResponse)
    return true
  }

  if (request?.type === 'AUTH_STATUS') {
    void authStatus(Boolean(request.probe)).then(sendResponse)
    return true
  }

  if (request?.type === 'AUTH_CANCEL') {
    cancelDevicePoll()
    sendResponse({ ok: true })
    return false
  }

  if (request?.type === 'AUTH_DISCONNECT') {
    void clearAccessToken()
      .then(() => setAccessWarning(null))
      .then(() => sendResponse({ ok: true }))
    return true
  }

  if (request?.type === 'AUTH_SET_PAT') {
    void authSetPat(request.token).then(sendResponse)
    return true
  }

  if (request?.type === 'OPEN_OPTIONS') {
    void chrome.runtime.openOptionsPage()
    sendResponse({ ok: true })
    return false
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
        sendResponse({
          error: formatCaughtApiError(error, 'Failed to load the Markdown file'),
        })
      })
    return true
  }

  if (request?.type === 'FETCH_THREAD_INDEX') {
    void fetchThreadIndex(
      request.owner,
      request.repo,
      request.pullNumber,
      request.path,
    )
      .then((index: ThreadIndexDto) => sendResponse(index))
      .catch((error: unknown) => {
        sendResponse({
          error: formatCaughtApiError(
            error,
            'Failed to load review comments',
          ),
        })
      })
    return true
  }

  if (request?.type === 'CREATE_REVIEW_COMMENT') {
    void createReviewComment({
      owner: request.owner,
      repo: request.repo,
      pullNumber: request.pullNumber,
      path: request.path,
      body: request.body,
      commitId: request.commitId,
      side: request.side,
      line: request.line,
      startLine: request.startLine,
      startSide: request.startSide,
    })
      .then((comment: ReviewCommentDto) => sendResponse(comment))
      .catch((error: unknown) => {
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to create the review comment'
        sendResponse({ error: message })
      })
    return true
  }

  if (request?.type === 'REPLY_REVIEW_COMMENT') {
    void replyToReviewComment({
      owner: request.owner,
      repo: request.repo,
      pullNumber: request.pullNumber,
      inReplyToId: request.inReplyToId,
      body: request.body,
    })
      .then((comment: ReviewCommentDto) => sendResponse(comment))
      .catch((error: unknown) => {
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to reply to the review comment'
        sendResponse({ error: message })
      })
    return true
  }

  if (request?.type === 'UPDATE_REVIEW_COMMENT') {
    void updateReviewComment({
      owner: request.owner,
      repo: request.repo,
      commentId: request.commentId,
      body: request.body,
    })
      .then((comment: ReviewCommentDto) => sendResponse(comment))
      .catch((error: unknown) => {
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to update the review comment'
        sendResponse({ error: message })
      })
    return true
  }

  if (request?.type === 'DELETE_REVIEW_COMMENT') {
    void deleteReviewComment({
      owner: request.owner,
      repo: request.repo,
      commentId: request.commentId,
    })
      .then(() => sendResponse({ ok: true as const }))
      .catch((error: unknown) => {
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to delete the review comment'
        sendResponse({ error: message })
      })
    return true
  }

  return false
})

console.debug('[Markdup] background service worker ready')
