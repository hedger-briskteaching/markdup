const API_VERSION = '2022-11-28'

/**
 * Error thrown when a GitHub REST API request fails.
 * @param message - Human-readable error description.
 * @param status - HTTP status code from GitHub.
 * @param body - Parsed response body, if available.
 */
export class GitHubApiError extends Error {
  readonly status: number
  readonly body?: unknown

  constructor(message: string, status: number, body?: unknown) {
    super(message)
    this.name = 'GitHubApiError'
    this.status = status
    this.body = body
  }
}

/**
 * Build a human-readable message from a GitHub error response.
 * Prefers per-field validation messages over the generic "Validation Failed".
 * @param status - HTTP status code from the response.
 * @param parsed - Parsed JSON body of the error response.
 * @returns A single descriptive error string.
 */
export function formatGitHubErrorMessage(
  status: number,
  parsed: unknown,
): string {
  if (typeof parsed === 'object' && parsed !== null) {
    const record = parsed as {
      message?: unknown
      errors?: Array<{ message?: unknown; field?: unknown }>
    }
    const details =
      Array.isArray(record.errors) && record.errors.length > 0
        ? record.errors
            .map((err) =>
              typeof err.message === 'string' && err.message.length > 0
                ? err.message
                : typeof err.field === 'string'
                  ? `Invalid ${err.field}`
                  : null,
            )
            .filter((m): m is string => Boolean(m))
        : []

    if (details.length > 0) {
      return details.join(' ')
    }

    if (typeof record.message === 'string' && record.message.length > 0) {
      return record.message
    }
  }

  return `GitHub request failed (${status})`
}

/**
 * Run an authenticated request against the GitHub REST API.
 * @param path - API path relative to the base URL (for example `/repos/owner/repo`).
 * @param options - Request configuration (token, method, body, headers, base URL).
 * @returns Parsed JSON response body typed as T.
 */
export async function githubFetch<T>(
  path: string,
  options: {
    token?: string | null
    method?: string
    body?: unknown
    headers?: Record<string, string>
    baseUrl?: string
  } = {},
): Promise<T> {
  const baseUrl = options.baseUrl ?? 'https://api.github.com'
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': API_VERSION,
    ...options.headers,
  }

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`
  }

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  const text = await response.text()
  let parsed: unknown = undefined
  if (text) {
    try {
      parsed = JSON.parse(text) as unknown
    } catch {
      parsed = text
    }
  }

  if (!response.ok) {
    throw new GitHubApiError(
      formatGitHubErrorMessage(response.status, parsed),
      response.status,
      parsed,
    )
  }

  return parsed as T
}
