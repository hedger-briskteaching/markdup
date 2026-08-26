/** GitHub's maximum Markdown body length for a review comment. */
export const GITHUB_COMMENT_BODY_MAX_LENGTH = 65_536;

/** Leave room for API-side normalization and small editor additions. */
export const GITHUB_COMMENT_BODY_SAFE_LENGTH = 60_000;

/** Return a user-facing error when a comment cannot fit GitHub's body limit. */
export function commentBodyLengthError(body: string): string | null {
  if (body.length <= GITHUB_COMMENT_BODY_MAX_LENGTH) return null;
  return `Comment is too long (${body.length.toLocaleString()} characters). GitHub allows 65,536.`;
}
