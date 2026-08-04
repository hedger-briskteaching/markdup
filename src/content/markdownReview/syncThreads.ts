import type { ReviewThreadDto } from '../../shared/messages'
import {
  getRichViewContext,
  setRichViewContext,
  type RichViewContext,
} from './selection'
import { renderThreadCards } from './threads'

export type SyncThreadsResult =
  | { ok: true; threads: ReviewThreadDto[] }
  | { ok: false; error: string }

type FetchThreadIndexResponse =
  | { threads: ReviewThreadDto[]; error?: undefined }
  | { error: string; threads?: undefined }

/**
 * Replace rich-view thread state with GitHub's current index for this file.
 * GitHub is the only store — never keep local-only thread cards.
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

export function applyServerThreads(
  richRoot: Element,
  threads: ReviewThreadDto[],
): void {
  const current = getRichViewContext(richRoot)
  if (!current) return
  // Full replace — never merge inventively with stale local cards.
  setRichViewContext(richRoot, { ...current, threads })
  renderThreadCards(richRoot)
}

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}
