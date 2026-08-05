/** Message types between the popup, content scripts, and the background worker. */

export type AuthEnsureRequest = {
  type: 'AUTH_ENSURE'
}

export type AuthCancelRequest = {
  type: 'AUTH_CANCEL'
}

export type AuthStatusRequest = {
  type: 'AUTH_STATUS'
  /** When true and auth is OAuth, probe organization OAuth App access again. */
  probe?: boolean
}

export type AuthDisconnectRequest = {
  type: 'AUTH_DISCONNECT'
}

export type AuthSetPatRequest = {
  type: 'AUTH_SET_PAT'
  token: string
}

/** Content scripts cannot call chrome.runtime.openOptionsPage. */
export type OpenOptionsRequest = {
  type: 'OPEN_OPTIONS'
}

export type FetchFileSnapshotRequest = {
  type: 'FETCH_FILE_SNAPSHOT'
  owner: string
  repo: string
  pullNumber: number
  path: string
}

export type FetchThreadIndexRequest = {
  type: 'FETCH_THREAD_INDEX'
  owner: string
  repo: string
  pullNumber: number
  path: string
}

export type CreateReviewCommentRequest = {
  type: 'CREATE_REVIEW_COMMENT'
  owner: string
  repo: string
  pullNumber: number
  path: string
  body: string
  commitId: string
  side: 'LEFT' | 'RIGHT'
  line: number
  startLine?: number
  startSide?: 'LEFT' | 'RIGHT'
}

export type ReplyReviewCommentRequest = {
  type: 'REPLY_REVIEW_COMMENT'
  owner: string
  repo: string
  pullNumber: number
  inReplyToId: number
  body: string
}

export type UpdateReviewCommentRequest = {
  type: 'UPDATE_REVIEW_COMMENT'
  owner: string
  repo: string
  pullNumber: number
  commentId: number
  body: string
}

export type DeleteReviewCommentRequest = {
  type: 'DELETE_REVIEW_COMMENT'
  owner: string
  repo: string
  pullNumber: number
  commentId: number
}

export type ExtensionRequest =
  | AuthEnsureRequest
  | AuthCancelRequest
  | AuthStatusRequest
  | AuthDisconnectRequest
  | AuthSetPatRequest
  | OpenOptionsRequest
  | FetchFileSnapshotRequest
  | FetchThreadIndexRequest
  | CreateReviewCommentRequest
  | ReplyReviewCommentRequest
  | UpdateReviewCommentRequest
  | DeleteReviewCommentRequest

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
  /** How the local token was stored. */
  method?: 'oauth' | 'pat'
  /**
   * Present when OAuth works for /user but an organization blocks the Markdup
   * OAuth App. Guide the user to a personal access token.
   */
  accessWarning?: {
    kind: 'oauth_org_restricted'
    org?: string
    message: string
  } | null
}

export type AuthDisconnectResponse = { ok: true }

export type AuthCancelResponse = { ok: true }

export type AuthSetPatResponse =
  | { status: 'ok'; login: string }
  | { status: 'error'; message: string }

export type FileSnapshot = {
  owner: string
  repo: string
  pullNumber: number
  path: string
  baseSha: string
  headSha: string
  baseText: string | null
  headText: string | null
  /** Line numbers GitHub accepts for LEFT and RIGHT review comments. */
  commentable: {
    left: number[]
    right: number[]
  }
}

export type ReviewCommentDto = {
  id: number
  body: string
  path: string
  side: 'LEFT' | 'RIGHT' | null
  line: number | null
  startLine: number | null
  originalLine: number | null
  inReplyToId: number | null
  userLogin: string
  createdAt: string
  commitId: string
  htmlUrl: string
  pullRequestReviewId?: number | null
}

export type ReviewThreadDto = {
  rootId: number
  path: string
  side: 'LEFT' | 'RIGHT'
  startLine: number
  line: number
  comments: ReviewCommentDto[]
  pending?: boolean
}

export type ThreadIndexDto = {
  owner: string
  repo: string
  pullNumber: number
  path: string
  threads: ReviewThreadDto[]
}

export type AuthCompleteEvent = {
  type: 'AUTH_COMPLETE'
  login: string
  method?: 'oauth' | 'pat'
  accessWarning?: {
    kind: 'oauth_org_restricted'
    org?: string
    message: string
  } | null
}

export type AuthErrorEvent = {
  type: 'AUTH_ERROR'
  message: string
}

export type ExtensionEvent = AuthCompleteEvent | AuthErrorEvent
