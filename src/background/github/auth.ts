import {
  GITHUB_OAUTH_CLIENT_ID,
  GITHUB_OAUTH_SCOPES,
} from '../../shared/githubAuth'

const TOKEN_KEY = 'github.accessToken'
const LOGIN_KEY = 'github.login'
const OBTAINED_KEY = 'github.tokenObtainedAt'
const METHOD_KEY = 'github.authMethod'

export type AuthMethod = 'oauth' | 'pat'

const DEVICE_CODE_URL = 'https://github.com/login/device/code'
const ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token'
const DEVICE_GRANT = 'urn:ietf:params:oauth:grant-type:device_code'

export type DeviceCodeResponse = {
  device_code: string
  user_code: string
  verification_uri: string
  expires_in: number
  interval: number
}

type AccessTokenSuccess = {
  access_token: string
  token_type?: string
  scope?: string
}

type AccessTokenPending = {
  error:
    | 'authorization_pending'
    | 'slow_down'
    | 'expired_token'
    | 'access_denied'
    | 'unsupported_grant_type'
    | 'incorrect_device_code'
    | string
  error_description?: string
  interval?: number
}

export type StoredAuth = {
  token: string
  login: string
  method: AuthMethod
}

type FetchLike = typeof fetch

let activePoll: AbortController | null = null
let activeDevice: DeviceCodeResponse | null = null

/**
 * Return the in-progress device code response, or null if no flow is active.
 * @returns The active DeviceCodeResponse or null.
 */
export function getActiveDeviceCode(): DeviceCodeResponse | null {
  return activeDevice
}

/**
 * Read the stored GitHub access token from local storage.
 * @returns The token string, or null if none is stored.
 */
export async function getAccessToken(): Promise<string | null> {
  const result = await chrome.storage.local.get(TOKEN_KEY)
  const token = result[TOKEN_KEY]
  return typeof token === 'string' && token.length > 0 ? token : null
}

/**
 * Read the stored GitHub login (username) from local storage.
 * @returns The login string, or null if none is stored.
 */
export async function getStoredLogin(): Promise<string | null> {
  const result = await chrome.storage.local.get(LOGIN_KEY)
  const login = result[LOGIN_KEY]
  return typeof login === 'string' && login.length > 0 ? login : null
}

/**
 * Read the authentication method used for the stored token.
 * @returns `'oauth'`, `'pat'`, or null if not set.
 */
export async function getAuthMethod(): Promise<AuthMethod | null> {
  const result = await chrome.storage.local.get(METHOD_KEY)
  const method = result[METHOD_KEY]
  return method === 'oauth' || method === 'pat' ? method : null
}

/**
 * Persist a GitHub token, login, and auth method to local storage.
 * @param token - GitHub access token.
 * @param login - GitHub username.
 * @param method - How the token was obtained.
 */
export async function setAccessToken(
  token: string,
  login: string,
  method: AuthMethod = 'oauth',
): Promise<void> {
  await chrome.storage.local.set({
    [TOKEN_KEY]: token,
    [LOGIN_KEY]: login,
    [OBTAINED_KEY]: Date.now(),
    [METHOD_KEY]: method,
  })
}

/**
 * Remove all stored authentication data and cancel any active device poll.
 */
export async function clearAccessToken(): Promise<void> {
  cancelDevicePoll()
  await chrome.storage.local.remove([
    TOKEN_KEY,
    LOGIN_KEY,
    OBTAINED_KEY,
    METHOD_KEY,
  ])
}

/**
 * Validate and store a personal access token (classic or fine-grained).
 * Use when an org blocks the Markdup OAuth App.
 * @param rawToken - The raw PAT string pasted by the user.
 * @param fetchImpl - Optional fetch implementation for testing.
 * @returns The stored auth record with token, login, and method.
 */
export async function setPersonalAccessToken(
  rawToken: string,
  fetchImpl: FetchLike = fetch,
): Promise<StoredAuth> {
  const token = rawToken.trim()
  if (!token) {
    throw new Error('Paste a GitHub personal access token.')
  }
  if (!looksLikeGithubToken(token)) {
    throw new Error(
      'That does not look like a GitHub token. Use a classic PAT (ghp_…) or a fine-grained PAT (github_pat_…).',
    )
  }

  cancelDevicePoll()
  const user = await validateToken(token, fetchImpl)
  if (!user) {
    throw new Error(
      'GitHub rejected this token. Check that it is valid and has access to the repos you need.',
    )
  }

  await setAccessToken(token, user.login, 'pat')
  return { token, login: user.login, method: 'pat' }
}

/**
 * Make sure the token string matches a known GitHub PAT prefix.
 * @param token - Token string to test.
 * @returns True if the prefix is `ghp_` or `github_pat_`.
 */
function looksLikeGithubToken(token: string): boolean {
  return (
    token.startsWith('ghp_') ||
    token.startsWith('github_pat_')
  )
}

/**
 * Call the GitHub `/user` endpoint to make sure the token is valid.
 * @param token - GitHub access token to test.
 * @param fetchImpl - Optional fetch implementation for testing.
 * @returns An object with the login, or null if the token is invalid.
 */
export async function validateToken(
  token: string,
  fetchImpl: FetchLike = fetch,
): Promise<{ login: string } | null> {
  try {
    const response = await fetchImpl('https://api.github.com/user', {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })
    if (!response.ok) {
      return null
    }
    const user = (await response.json()) as { login?: string }
    return user.login ? { login: user.login } : null
  } catch {
    return null
  }
}

/**
 * Begin the GitHub OAuth device code flow and return the device code data.
 * @param fetchImpl - Optional fetch implementation for testing.
 * @returns Device code response containing the user code and verification URI.
 */
export async function startDeviceFlow(
  fetchImpl: FetchLike = fetch,
): Promise<DeviceCodeResponse> {
  const response = await fetchImpl(DEVICE_CODE_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: GITHUB_OAUTH_CLIENT_ID,
      scope: GITHUB_OAUTH_SCOPES.join(' '),
    }),
  })

  const data = (await response.json()) as DeviceCodeResponse & {
    error?: string
    error_description?: string
  }

  if (!response.ok || data.error || !data.device_code || !data.user_code) {
    throw new Error(
      data.error_description ??
        data.error ??
        'Failed to start GitHub device flow',
    )
  }

  activeDevice = data
  return data
}

/**
 * Abort any active device-code polling and clear the active device state.
 */
export function cancelDevicePoll(): void {
  activePoll?.abort()
  activePoll = null
  activeDevice = null
}

/**
 * Poll GitHub for an access token until the user authorizes or the code expires.
 * @param deviceCode - The device code string from the initial flow request.
 * @param intervalSeconds - Minimum seconds to wait between poll attempts.
 * @param options - Configuration for fetch, abort signal, max attempts, and sleep.
 * @returns The access token string once the user authorizes.
 */
export async function pollDeviceFlow(
  deviceCode: string,
  intervalSeconds: number,
  options: {
    fetchImpl?: FetchLike
    signal?: AbortSignal
    maxAttempts?: number
    sleep?: (ms: number, signal?: AbortSignal) => Promise<void>
  } = {},
): Promise<string> {
  const fetchImpl = options.fetchImpl ?? fetch
  const sleep = options.sleep ?? sleepMs
  const maxAttempts = options.maxAttempts ?? 120
  let intervalMs = Math.max(intervalSeconds, 1) * 1000

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (options.signal?.aborted) {
      throw new DOMException('Device flow cancelled', 'AbortError')
    }

    await sleep(intervalMs, options.signal)

    const response = await fetchImpl(ACCESS_TOKEN_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: GITHUB_OAUTH_CLIENT_ID,
        device_code: deviceCode,
        grant_type: DEVICE_GRANT,
      }),
      signal: options.signal,
    })

    const data = (await response.json()) as AccessTokenSuccess &
      AccessTokenPending

    if (data.access_token) {
      return data.access_token
    }

    if (data.error === 'authorization_pending') {
      continue
    }

    if (data.error === 'slow_down') {
      intervalMs += 5000
      continue
    }

    if (data.error === 'expired_token') {
      throw new Error('Device code expired. Start Connect again.')
    }

    if (data.error === 'access_denied') {
      throw new Error('GitHub authorization was denied.')
    }

    throw new Error(
      data.error_description ?? data.error ?? 'Device flow failed',
    )
  }

  throw new Error('Timed out waiting for GitHub authorization.')
}

/**
 * Poll for authorization, validate the token, and store the result.
 * Cancels any previous in-progress poll before starting.
 * @param device - Device code response from {@link startDeviceFlow}.
 * @param fetchImpl - Optional fetch implementation for testing.
 * @returns The stored auth record on success.
 */
export async function runDevicePollAndStore(
  device: DeviceCodeResponse,
  fetchImpl: FetchLike = fetch,
): Promise<StoredAuth> {
  cancelDevicePoll()
  const controller = new AbortController()
  activePoll = controller
  activeDevice = device

  try {
    const token = await pollDeviceFlow(device.device_code, device.interval, {
      fetchImpl,
      signal: controller.signal,
    })
    const user = await validateToken(token, fetchImpl)
    if (!user) {
      throw new Error('Received a token but could not read the GitHub user.')
    }
    await setAccessToken(token, user.login)
    return { token, login: user.login, method: 'oauth' as const }
  } finally {
    if (activePoll === controller) {
      activePoll = null
      activeDevice = null
    }
  }
}

/**
 * Wait for the given duration, aborting early if the signal fires.
 * @param ms - Milliseconds to sleep.
 * @param signal - Optional abort signal to cancel the sleep.
 */
async function sleepMs(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    throw new DOMException('Device flow cancelled', 'AbortError')
  }
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    /**
     * Abort the sleep when the signal fires.
     * @returns Nothing.
     */
    const onAbort = () => {
      clearTimeout(timer)
      reject(new DOMException('Device flow cancelled', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}
