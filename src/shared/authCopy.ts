/** Shared copy for GitHub access UI (simple English). */

export const TOKEN_STORAGE_FACTS = [
  'Markdup stores an access token only in this browser.',
  'The token is not shared with other people or other computers.',
  'Markdup has no server that keeps your token.',
  'GitHub receives the token only when Markdup calls the GitHub API.',
] as const

export const REVOKE_STEPS = [
  'Click Remove from this browser. Markdup deletes the local token.',
  'Optional: open GitHub Settings, then Applications. Revoke Markdup there to remove access on GitHub.',
] as const

export const GITHUB_APPLICATIONS_URL =
  'https://github.com/settings/applications'
