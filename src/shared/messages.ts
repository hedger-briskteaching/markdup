/** Runtime message types between popup/content and the background worker. */

export type AuthEnsureRequest = {
  type: 'AUTH_ENSURE'
}

export type AuthCancelRequest = {
  type: 'AUTH_CANCEL'
}

export type AuthStatusRequest = {
  type: 'AUTH_STATUS'
}

export type AuthDisconnectRequest = {
  type: 'AUTH_DISCONNECT'
}

export type FetchFileSnapshotRequest = {
  type: 'FETCH_FILE_SNAPSHOT'
  owner: string
  repo: string
  pullNumber: number
  path: string
}

export type ExtensionRequest =
  | AuthEnsureRequest
  | AuthCancelRequest
  | AuthStatusRequest
  | AuthDisconnectRequest
  | FetchFileSnapshotRequest

export type AuthEnsureResponse =
  | { status: 'ok'; login: string }
  | {
      status: 'needs_auth'
      user_code: string
      verification_uri: string
      expires_in: number
    }
  | { status: 'error'; message: string }

export type AuthStatusResponse = {
  authenticated: boolean
  login?: string
}

export type AuthDisconnectResponse = { ok: true }

export type AuthCancelResponse = { ok: true }

export type FileSnapshot = {
  owner: string
  repo: string
  pullNumber: number
  path: string
  baseSha: string
  headSha: string
  baseText: string | null
  headText: string | null
}

export type AuthCompleteEvent = {
  type: 'AUTH_COMPLETE'
  login: string
}

export type AuthErrorEvent = {
  type: 'AUTH_ERROR'
  message: string
}

export type ExtensionEvent = AuthCompleteEvent | AuthErrorEvent
