import {
  accessWarningFromApiError,
  type AccessWarning,
  formatOrgOauthRestrictionGuidance,
  isOrgOauthRestrictionError,
} from '../../shared/oauthRestriction'
import { GitHubApiError, githubFetch } from './client'

const ACCESS_WARNING_KEY = 'github.accessWarning'

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
 * After OAuth, check whether any of the user's orgs block the Markdup OAuth App.
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

/** Remember a restriction discovered while calling the API (e.g. file snapshot). */
export async function recordApiAccessWarning(
  errorMessage: string,
): Promise<AccessWarning | null> {
  const warning = accessWarningFromApiError(errorMessage)
  if (warning) {
    await setAccessWarning(warning)
  }
  return warning
}
