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

export type ExtensionRequest =
  | AuthEnsureRequest
  | AuthCancelRequest
  | AuthStatusRequest
  | AuthDisconnectRequest

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

export type AuthCompleteEvent = {
  type: 'AUTH_COMPLETE'
  login: string
}

export type AuthErrorEvent = {
  type: 'AUTH_ERROR'
  message: string
}

export type ExtensionEvent = AuthCompleteEvent | AuthErrorEvent
