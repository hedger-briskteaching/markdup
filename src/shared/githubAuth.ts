/**
 * GitHub OAuth App credentials for Markdup.
 * Client ID is public. Never put a client secret in this repo.
 *
 * App: Markdup (hedger-briskteaching)
 * Auth: Device Flow (no server / no client secret)
 * Callback (identity): https://knlaahnhnocjejneaobpbbnfibfnoiei.chromiumapp.org/
 */
export const GITHUB_OAUTH_CLIENT_ID = "Ov23ligHmXvOghPDOSCF";

/** Stable Chrome extension ID (from manifest `key`). */
export const EXTENSION_ID = "knlaahnhnocjejneaobpbbnfibfnoiei";

export const GITHUB_OAUTH_REDIRECT_URL = `https://${EXTENSION_ID}.chromiumapp.org/`;

/**
 * Scopes for reading PR file contents and writing review comments.
 * Tighten later if the OAuth App supports finer scopes.
 */
export const GITHUB_OAUTH_SCOPES = ["repo"] as const;
