/** Shared copy for GitHub access UI (simple English). */

export const TOKEN_STORAGE_FACTS = [
  'Markdup stores an access token only in this browser.',
  'The token is not shared with other people or other computers.',
  'Markdup has no server that keeps your token.',
  'GitHub receives the token only when Markdup calls the GitHub API.',
] as const

export const REVOKE_STEPS = [
  'Click Remove from this browser. Markdup deletes the local token.',
  'If you used Connect with GitHub: open GitHub Settings → Applications and revoke Markdup.',
  'If you pasted a personal access token: open GitHub Settings → Developer settings → Personal access tokens and delete or regenerate that token.',
] as const

export const GITHUB_APPLICATIONS_URL =
  'https://github.com/settings/applications'

/** Classic PAT create page with repo scope preselected when possible. */
export const GITHUB_PAT_CREATE_URL =
  'https://github.com/settings/tokens/new?description=Markdup&scopes=repo'

export const GITHUB_PAT_LIST_URL = 'https://github.com/settings/tokens'

export const AUTH_OAUTH_HINT =
  'Try this first. Authorize Markdup with GitHub Device Flow when your organization allows the Markdup OAuth App.'

export const AUTH_PAT_WHY = [
  'Use this as a fallback when Option 1 fails — for example when an organization blocks third-party OAuth Apps until an owner approves them.',
  'A personal access token belongs to you, not to the Markdup OAuth App, so it often still works on those orgs.',
  'Markdup uses the token only to read Markdown files on a pull request and to post review comments.',
] as const

export const AUTH_PAT_HOW_STEPS = [
  'Open GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic). Or use the link below.',
  'Click Generate new token, then choose Generate new token (classic) — not “Fine-grained, repo-scoped.”',
  'In Note, enter a name such as Markdup. Pick an Expiration (for example 30 days).',
  'Under Select scopes, check only the top repo box (“Full control of private repositories”). Leave every other scope unchecked (workflow, admin:org, gist, user, notifications, and the rest).',
  'Scroll to the bottom and click Generate token. Copy the secret that starts with ghp_. GitHub shows it only once.',
  'Paste the token below and click Save token. Markdup keeps it only in this browser.',
] as const

export const AUTH_PAT_FINE_GRAINED_NOTE =
  'Prefer classic for Markdup. Fine-grained tokens (github_pat_…) can work if your org allows them, but they often need owner approval. If you use one anyway: Contents Read and Pull requests Read and write on the repos you review.'
