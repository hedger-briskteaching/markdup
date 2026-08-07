import { alignMarkdown } from '../../markdown/align'
import type { FileSnapshot } from '../../shared/messages'
import { commentableFromDto } from '../../shared/commentableLines'
import { consumeCommentsDirty } from './composer'
import {
  hasRichPathIntent,
  setRichPathIntent,
} from './richIntent'
import {
  ensureNativeDiffHidden,
  hideRichView,
  isRichMode,
  showRichError,
  showRichLoading,
  showRichView,
} from './richView'
import { syncFileCollapsedState } from './headerControls'
import {
  getCachedSnapshot,
  getCachedViewerLogin,
  setCachedSnapshot,
  setCachedViewerLogin,
} from './snapshotCache'
import { RGM_TOGGLE } from './selectors'
import { syncThreadsFromServer } from './syncThreads'

export { isRichMode }

/**
 * Parse the current URL to extract owner, repo, and pull number.
 * @returns The parsed pull request identifiers, or null if not on a PR page.
 */
function parseLocationPull(): {
  owner: string
  repo: string
  pullNumber: number
} | null {
  const match = location.pathname.match(
    /^\/([^/]+)\/([^/]+)\/pull\/(\d+)/,
  )
  if (!match) {
    return null
  }
  return {
    owner: match[1]!,
    repo: match[2]!,
    pullNumber: Number(match[3]),
  }
}

/**
 * Get the file path associated with a file region element.
 * @param region - The file region element.
 * @returns The file path string, or null if not found.
 */
function filePathForRegion(region: Element): string | null {
  const fromToggle = region
    .querySelector(RGM_TOGGLE)
    ?.getAttribute('data-rgm-file')
  if (fromToggle) {
    return fromToggle
  }
  const button = region.querySelector<HTMLElement>('button[data-file-path]')
  return button?.getAttribute('data-file-path') ?? null
}

/**
 * Fetch the base and head file content from the background script.
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param pullNumber - Pull request number.
 * @param path - File path within the repository.
 * @returns The file snapshot with base and head text.
 */
async function loadSnapshot(
  owner: string,
  repo: string,
  pullNumber: number,
  path: string,
): Promise<FileSnapshot> {
  const response = (await chrome.runtime.sendMessage({
    type: 'FETCH_FILE_SNAPSHOT',
    owner,
    repo,
    pullNumber,
    path,
  })) as FileSnapshot | { error: string }

  if (response && 'error' in response) {
    throw new Error(response.error)
  }
  return response
}

/**
 * Turn rich mode on or off for a file region.
 * When turning on, fetch base/head Markdown and render the rich view.
 * @param region - The file region element.
 * @param rich - True to activate rich mode, false to deactivate.
 * @returns Nothing.
 */
export function setRichMode(region: Element, rich: boolean): void {
  const path = filePathForRegion(region)
  if (path) {
    setRichPathIntent(path, rich)
  }

  if (!rich) {
    const needsNativeRefresh = consumeCommentsDirty(region)
    region.removeAttribute('data-rgm-mode')
    hideRichView(region)
    // GitHub native Files DOM was painted before our API comments existed.
    // Unhiding alone leaves stale widgets. Reload so pending threads appear.
    if (needsNativeRefresh) {
      window.location.reload()
    }
    return
  }

  region.setAttribute('data-rgm-mode', 'rich')
  void mountRichView(region)
}

/**
 * Re-apply rich mode after GitHub re-renders a file section.
 * Does nothing when intent is off or the rich root is already mounted.
 * @param region - The file region element.
 * @returns Nothing.
 */
export function ensureRichMounted(region: Element): void {
  const path = filePathForRegion(region)
  if (!path || !hasRichPathIntent(path)) {
    return
  }

  region.setAttribute('data-rgm-mode', 'rich')

  if (region.querySelector('[data-rgm-rich]')) {
    // Collapse/expand remounts GitHub diff body without our hide marker.
    ensureNativeDiffHidden(region)
    syncFileCollapsedState(region)
    return
  }

  void mountRichView(region)
}

/**
 * Load the file snapshot and render the rich markdown diff view.
 * @param region - The file region element.
 * @returns Nothing.
 */
async function mountRichView(region: Element): Promise<void> {
  const pull = parseLocationPull()
  const path = filePathForRegion(region)

  if (!pull || !path) {
    showRichError(
      region,
      'This page is not a pull request Files view, or the file path is missing.',
    )
    return
  }

  const cached = getCachedSnapshot(pull.owner, pull.repo, pull.pullNumber, path)
  const cachedLogin = getCachedViewerLogin()
  // A cache hit can mount without a single round trip, so skip the spinner.
  if (!cached) {
    showRichLoading(region)
  }

  try {
    const snapshot =
      cached?.snapshot ??
      (await loadSnapshot(pull.owner, pull.repo, pull.pullNumber, path))

    if (region.getAttribute('data-rgm-mode') !== 'rich') {
      return
    }

    if (snapshot.baseText == null && snapshot.headText == null) {
      showRichError(
        region,
        'This file could not be loaded at the pull request base or head.',
      )
      return
    }

    const rows =
      cached?.rows ??
      alignMarkdown(snapshot.baseText ?? '', snapshot.headText ?? '')
    if (!cached) {
      setCachedSnapshot(pull.owner, pull.repo, pull.pullNumber, path, {
        snapshot,
        rows,
      })
    }

    const viewerLogin = cachedLogin
      ? cachedLogin.value
      : await fetchViewerLogin()
    if (!cachedLogin) {
      setCachedViewerLogin(viewerLogin)
    }
    if (region.getAttribute('data-rgm-mode') !== 'rich') {
      return
    }
    showRichView(region, rows, {
      baseText: snapshot.baseText ?? '',
      headText: snapshot.headText ?? '',
      owner: snapshot.owner,
      repo: snapshot.repo,
      pullNumber: snapshot.pullNumber,
      path: snapshot.path,
      baseSha: snapshot.baseSha,
      headSha: snapshot.headSha,
      commentable: commentableFromDto(
        snapshot.commentable ?? { left: [], right: [] },
      ),
      viewerLogin,
    })

    void loadThreadIndex(region, snapshot)
  } catch (error) {
    if (region.getAttribute('data-rgm-mode') !== 'rich') {
      return
    }
    const message =
      error instanceof Error
        ? error.message
        : 'The rich Markdown view failed to load.'
    showRichError(region, message)
  }
}

/**
 * Render from local strings without calling the GitHub API.
 * @internal Vitest helper.
 * @param region - The file region element.
 * @param baseText - Base-side markdown text.
 * @param headText - Head-side markdown text.
 * @returns Nothing.
 */
export function setRichModeFromTexts(
  region: Element,
  baseText: string,
  headText: string,
): void {
  const path = filePathForRegion(region)
  if (path) {
    setRichPathIntent(path, true)
  }
  region.setAttribute('data-rgm-mode', 'rich')
  const rows = alignMarkdown(baseText, headText)
  showRichView(region, rows, { baseText, headText })
}

/**
 * Load and apply the thread index for a file region.
 * @param region - The file region element.
 * @param snapshot - The file snapshot containing pull request metadata.
 * @returns Nothing.
 */
async function loadThreadIndex(
  region: Element,
  snapshot: FileSnapshot,
): Promise<void> {
  const rich = region.querySelector('[data-rgm-rich]')
  if (!rich) return

  const result = await syncThreadsFromServer(rich, {
    owner: snapshot.owner,
    repo: snapshot.repo,
    pullNumber: snapshot.pullNumber,
    path: snapshot.path,
  })

  if (region.getAttribute('data-rgm-mode') !== 'rich') {
    return
  }
  if (!result.ok) {
    console.warn('[Markdup] thread sync failed', result.error)
  }
}

/**
 * Fetch the signed-in GitHub login from the background script.
 * @returns The viewer login string, or undefined if unavailable.
 */
async function fetchViewerLogin(): Promise<string | undefined> {
  try {
    const status = (await chrome.runtime.sendMessage({
      type: 'AUTH_STATUS',
    })) as { authenticated?: boolean; login?: string }
    if (status?.authenticated && status.login) {
      return status.login
    }
  } catch {
    // Auth status unavailable — edit/delete stay hidden.
  }
  return undefined
}
