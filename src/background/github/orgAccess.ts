import {
  accessWarningFromApiError,
  type AccessWarning,
  formatOrgOauthRestrictionGuidance,
  isOrgOauthRestrictionError,
} from '../../shared/oauthRestriction'
import { GitHubApiError, githubFetch } from './client'

const ACCESS_WARNING_KEY = 'github.accessWarning'

/**
 * Read the stored access warning from local storage.
 * @returns The persisted AccessWarning, or null if none exists.
 */
export async function getAccessWarning(): Promise<AccessWarning | null> {
  const result = await chrome.storage.local.get(ACCESS_WARNING_KEY)
  const value = result[ACCESS_WARNING_KEY]
  if (
    value &&
    typeof value === 'object' &&
    (value as AccessWarning).kind === 'oauth_org_restricted' &&
    typeof (value as AccessWarning).message === 'string'
  ) {
    return value as AccessWarning
  }
  return null
}

/**
 * Persist or clear an access warning in local storage.
 * @param warning - The warning to store, or null to remove it.
 */
export async function setAccessWarning(
  warning: AccessWarning | null,
): Promise<void> {
  if (!warning) {
    await chrome.storage.local.remove(ACCESS_WARNING_KEY)
    return
  }
  await chrome.storage.local.set({ [ACCESS_WARNING_KEY]: warning })
}

/**
 * After OAuth, make sure none of the user's orgs block the Markdup OAuth App.
 * Tests up to 15 orgs by fetching one repo from each.
 * @param token - GitHub access token to probe with.
 * @returns An AccessWarning if a restriction is found, or null.
 */
export async function probeOauthOrgAccess(
  token: string,
): Promise<AccessWarning | null> {
  let orgs: { login: string }[]
  try {
    orgs = await githubFetch<{ login: string }[]>('/user/orgs?per_page=30', {
      token,
    })
  } catch (error) {
    if (
      error instanceof GitHubApiError &&
      isOrgOauthRestrictionError(error.message)
    ) {
      return accessWarningFromApiError(error.message)
    }
    return null
  }

  for (const org of orgs.slice(0, 15)) {
    try {
      await githubFetch(
        `/orgs/${encodeURIComponent(org.login)}/repos?per_page=1&type=all`,
        { token },
      )
    } catch (error) {
      if (
        error instanceof GitHubApiError &&
        isOrgOauthRestrictionError(error.message)
      ) {
        return {
          kind: 'oauth_org_restricted',
          org: org.login,
          message: formatOrgOauthRestrictionGuidance(org.login),
        }
      }
    }
  }

  return null
}

/**
 * Record an OAuth restriction discovered during a normal API call.
 * Persists the warning if the error message matches a known pattern.
 * @param errorMessage - The error message string from the failed API call.
 * @returns The stored AccessWarning, or null if the error was not a restriction.
 */
export async function recordApiAccessWarning(
  errorMessage: string,
): Promise<AccessWarning | null> {
  const warning = accessWarningFromApiError(errorMessage)
  if (warning) {
    await setAccessWarning(warning)
  }
  return warning
}
