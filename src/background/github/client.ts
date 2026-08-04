const API_VERSION = '2022-11-28'

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
    const message =
      typeof parsed === 'object' &&
      parsed !== null &&
      'message' in parsed &&
      typeof (parsed as { message: unknown }).message === 'string'
        ? (parsed as { message: string }).message
        : `GitHub request failed (${response.status})`
    throw new GitHubApiError(message, response.status, parsed)
  }

  return parsed as T
}
