/** Detect GitHub org OAuth App access restrictions and build user-facing copy. */

export type AccessWarning = {
  kind: 'oauth_org_restricted'
  /** Organization login when known (for example briskedu). */
  org?: string
  message: string
}

const RESTRICTION_SNIPPET = 'OAuth App access restrictions'

/**
 * Return true when GitHub rejected the request because an org blocks the OAuth App.
 * @param message - Error message from the GitHub API.
 * @returns True when the message names OAuth App access restrictions.
 */
export function isOrgOauthRestrictionError(message: string): boolean {
  return message.includes(RESTRICTION_SNIPPET)
}

/**
 * Parse the organization login from an OAuth App restriction error message.
 * @param message - Error text such as `'orgname' organization has enabled OAuth App access restrictions`.
 * @returns Organization login, or null when the pattern does not match.
 */
export function parseOrgFromOauthRestriction(message: string): string | null {
  const match = message.match(
    /'([^']+)' organization has enabled OAuth App access restrictions/i,
  )
  return match?.[1] ?? null
}

/**
 * Build an access warning from a GitHub API error message when it is an org restriction.
 * @param message - Error message from the GitHub API.
 * @returns Access warning, or null when the error is not an org restriction.
 */
export function accessWarningFromApiError(message: string): AccessWarning | null {
  if (!isOrgOauthRestrictionError(message)) {
    return null
  }
  const org = parseOrgFromOauthRestriction(message) ?? undefined
  return {
    kind: 'oauth_org_restricted',
    org,
    message: formatOrgOauthRestrictionGuidance(org),
  }
}

/**
 * Build guidance that tells the user to use a personal access token.
 * @param org - Organization login when known.
 * @returns User-facing guidance string.
 */
export function formatOrgOauthRestrictionGuidance(org?: string): string {
  const who = org ? `The ${org} organization` : 'This organization'
  return `${who} blocks the Markdup OAuth App. Use Option 2 below — paste a personal access token — so Markdup can access those repos.`
}

/**
 * Build a short error for the rich Markdown view that points to Settings.
 * @param org - Organization login when known.
 * @returns Short user-facing error string.
 */
export function formatOrgOauthRestrictionRichError(org?: string): string {
  const who = org ? `The ${org} organization` : 'This organization'
  return `${who} blocks the Markdup OAuth App. Open Markdup Settings and use Option 2 (personal access token).`
}
