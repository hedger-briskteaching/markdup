/** Detect GitHub org OAuth App access restrictions and user-facing copy. */

export type AccessWarning = {
  kind: 'oauth_org_restricted'
  /** Organization login when known (e.g. briskedu). */
  org?: string
  message: string
}

const RESTRICTION_SNIPPET = 'OAuth App access restrictions'

/** True when GitHub rejected the request because an org blocks the OAuth App. */
export function isOrgOauthRestrictionError(message: string): boolean {
  return message.includes(RESTRICTION_SNIPPET)
}

/** Parse `'orgname' organization has enabled OAuth App access restrictions`. */
export function parseOrgFromOauthRestriction(message: string): string | null {
  const match = message.match(
    /'([^']+)' organization has enabled OAuth App access restrictions/i,
  )
  return match?.[1] ?? null
}

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

export function formatOrgOauthRestrictionGuidance(org?: string): string {
  const who = org ? `The ${org} organization` : 'This organization'
  return `${who} blocks the Markdup OAuth App. Use Option 2 below — paste a personal access token — so Markdup can access those repos.`
}

/** Short error for the rich Markdown view (points users at Settings). */
export function formatOrgOauthRestrictionRichError(org?: string): string {
  const who = org ? `The ${org} organization` : 'This organization'
  return `${who} blocks the Markdup OAuth App. Open Markdup Settings and use Option 2 (personal access token).`
}
