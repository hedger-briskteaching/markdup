import type { ReviewThreadDto } from '../../shared/messages'
import {
  getRichViewContext,
  setRichViewContext,
  type RichViewContext,
} from './selection'
import { expandSectionsForThreads, renderRichBody } from './renderBody'

export type SyncThreadsResult =
  | { ok: true; threads: ReviewThreadDto[] }
  | { ok: false; error: string }

type FetchThreadIndexResponse =
  | { threads: ReviewThreadDto[]; error?: undefined }
  | { error: string; threads?: undefined }

/**
 * Replace rich-view thread state with the current index from GitHub.
 * GitHub is the only store. Never keep local-only thread cards.
 * @param richRoot - The rich view root element.
 * @param ctx - Pull request identifiers and file path.
 * @param options - Polling configuration for post-create confirmation.
 * @returns A result indicating success with threads or failure with an error.
 */
export async function syncThreadsFromServer(
  richRoot: Element,
  ctx: Pick<RichViewContext, 'owner' | 'repo' | 'pullNumber' | 'path'>,
  options?: {
    /** Keep polling until this comment id appears (post-create confirm). */
    expectCommentId?: number
    attempts?: number
    delayMs?: number
  },
): Promise<SyncThreadsResult> {
  if (!ctx.owner || !ctx.repo || !ctx.pullNumber || !ctx.path) {
    return { ok: false, error: 'Missing pull request context for sync.' }
  }

  const attempts = options?.attempts ?? (options?.expectCommentId ? 6 : 1)
  const delayMs = options?.delayMs ?? 250
  let lastError = 'Could not load review comments from GitHub.'

  for (let i = 0; i < attempts; i += 1) {
    if (i > 0) {
      await sleep(delayMs)
    }

    const response = await fetchThreadIndex(ctx)
    if ('error' in response && response.error) {
      lastError = response.error
      continue
    }
    if (!response.threads) {
      continue
    }

    if (
      options?.expectCommentId != null &&
      !threadsContainComment(response.threads, options.expectCommentId)
    ) {
      lastError = 'Posted comment is not visible in GitHub yet.'
      continue
    }

    applyServerThreads(richRoot, response.threads)
    return { ok: true, threads: response.threads }
  }

  return { ok: false, error: lastError }
}

/**
 * Replace local thread state with server threads and re-render the body.
 * @param richRoot - The rich view root element.
 * @param threads - The threads from the server.
 * @returns Nothing.
 */
export function applyServerThreads(
  richRoot: Element,
  threads: ReviewThreadDto[],
): void {
  const current = getRichViewContext(richRoot)
  if (!current) return
  // Full replace. Never merge with stale local cards.
  setRichViewContext(richRoot, { ...current, threads })
  // Comments must never hide behind a fold. Expand their sections then rebuild.
  expandSectionsForThreads(richRoot)
  renderRichBody(richRoot)
}

/**
 * Determine if any thread contains a comment with the given id.
 * @param threads - Array of threads to search.
 * @param commentId - The comment id to look for.
 * @returns True when the comment is found in any thread.
 */
function threadsContainComment(
  threads: ReviewThreadDto[],
  commentId: number,
): boolean {
  return threads.some(
    (thread) =>
      thread.rootId === commentId ||
      thread.comments.some((c) => c.id === commentId),
  )
}

/**
 * Fetch the thread index for a file from the background script.
 * @param ctx - Pull request identifiers and file path.
 * @returns The thread index response or an error.
 */
async function fetchThreadIndex(
  ctx: Pick<RichViewContext, 'owner' | 'repo' | 'pullNumber' | 'path'>,
): Promise<FetchThreadIndexResponse> {
  try {
    const response = (await chrome.runtime.sendMessage({
      type: 'FETCH_THREAD_INDEX',
      owner: ctx.owner,
      repo: ctx.repo,
      pullNumber: ctx.pullNumber,
      path: ctx.path,
    })) as FetchThreadIndexResponse

    if (!response) {
      return { error: 'Empty response while loading review comments.' }
    }
    return response
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : 'Failed to load review comments.',
    }
  }
}

/**
 * Wait for a given number of milliseconds.
 * @param ms - The delay in milliseconds.
 * @returns A promise that resolves after the delay.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}
