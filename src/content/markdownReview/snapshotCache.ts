/**
 * Per-page cache for the data a rich view needs to mount.
 *
 * Mounting a file costs a snapshot fetch, a viewer-login fetch, and a Markdown
 * parse and align pass. That is fine once, but the rich view is rebuilt every
 * time GitHub re-renders a file section, and a pull request with several
 * Markdown files pays it for each one at the same time.
 *
 * Base and head content are immutable for a given commit, so a snapshot is
 * safe to keep for as long as the page lives. A reload starts over, which is
 * also what happens when the pull request gains a new commit.
 */

import type { RowModel } from '../../markdown/align'
import type { FileSnapshot } from '../../shared/messages'

type CacheEntry = {
  snapshot: FileSnapshot
  /** Aligned rows for this snapshot, parsed once. */
  rows: RowModel[]
}

const entries = new Map<string, CacheEntry>()
let viewerLogin: { value: string | undefined } | null = null

/**
 * Build the cache key for one file in one pull request.
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param pullNumber - Pull request number.
 * @param path - File path within the repository.
 * @returns The cache key.
 */
function keyFor(
  owner: string,
  repo: string,
  pullNumber: number,
  path: string,
): string {
  return `${owner}/${repo}/${pullNumber}/${path}`
}

/**
 * Read a cached snapshot and its aligned rows.
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param pullNumber - Pull request number.
 * @param path - File path within the repository.
 * @returns The cached entry, or undefined on a miss.
 */
export function getCachedSnapshot(
  owner: string,
  repo: string,
  pullNumber: number,
  path: string,
): CacheEntry | undefined {
  return entries.get(keyFor(owner, repo, pullNumber, path))
}

/**
 * Store a snapshot and its aligned rows for later mounts.
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param pullNumber - Pull request number.
 * @param path - File path within the repository.
 * @param entry - The snapshot and its aligned rows.
 * @returns Nothing.
 */
export function setCachedSnapshot(
  owner: string,
  repo: string,
  pullNumber: number,
  path: string,
  entry: CacheEntry,
): void {
  entries.set(keyFor(owner, repo, pullNumber, path), entry)
}

/**
 * Read the cached viewer login.
 * Wrapped so that a signed-out viewer (undefined) still counts as cached.
 * @returns The cached box, or null when the login has not been read yet.
 */
export function getCachedViewerLogin(): { value: string | undefined } | null {
  return viewerLogin
}

/**
 * Store the viewer login for later mounts.
 * @param value - The GitHub login, or undefined when signed out.
 * @returns Nothing.
 */
export function setCachedViewerLogin(value: string | undefined): void {
  viewerLogin = { value }
}

/**
 * Drop everything cached. Used by tests and when the page data is replaced.
 * @returns Nothing.
 */
export function clearSnapshotCache(): void {
  entries.clear()
  viewerLogin = null
}
