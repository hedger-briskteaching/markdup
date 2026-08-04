import { alignMarkdown } from '../../markdown/align'
import type { FileSnapshot, ThreadIndexDto } from '../../shared/messages'
import {
  hideRichView,
  isRichMode,
  showRichError,
  showRichLoading,
  showRichView,
} from './richView'
import { RGM_TOGGLE } from './selectors'
import { getRichViewContext, setRichViewContext } from './selection'

export { isRichMode }

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
 * When rich mode turns on, fetch base/head Markdown and render the view.
 */
export function setRichMode(region: Element, rich: boolean): void {
  if (!rich) {
    region.removeAttribute('data-rgm-mode')
    hideRichView(region)
    return
  }

  region.setAttribute('data-rgm-mode', 'rich')
  void mountRichView(region)
}

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

  showRichLoading(region)

  try {
    const snapshot = await loadSnapshot(
      pull.owner,
      pull.repo,
      pull.pullNumber,
      path,
    )

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

    const rows = alignMarkdown(
      snapshot.baseText ?? '',
      snapshot.headText ?? '',
    )
    showRichView(region, rows, {
      baseText: snapshot.baseText ?? '',
      headText: snapshot.headText ?? '',
      owner: snapshot.owner,
      repo: snapshot.repo,
      pullNumber: snapshot.pullNumber,
      path: snapshot.path,
      baseSha: snapshot.baseSha,
      headSha: snapshot.headSha,
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

/** @internal Vitest helper — render from local strings (no GitHub API). */
export function setRichModeFromTexts(
  region: Element,
  baseText: string,
  headText: string,
): void {
  region.setAttribute('data-rgm-mode', 'rich')
  const rows = alignMarkdown(baseText, headText)
  showRichView(region, rows, { baseText, headText })
}

async function loadThreadIndex(
  region: Element,
  snapshot: FileSnapshot,
): Promise<void> {
  try {
    const response = (await chrome.runtime.sendMessage({
      type: 'FETCH_THREAD_INDEX',
      owner: snapshot.owner,
      repo: snapshot.repo,
      pullNumber: snapshot.pullNumber,
      path: snapshot.path,
    })) as ThreadIndexDto | { error: string }

    if (region.getAttribute('data-rgm-mode') !== 'rich') {
      return
    }
    if (!response || 'error' in response) {
      return
    }

    const rich = region.querySelector('[data-rgm-rich]')
    if (!rich) return
    const ctx = getRichViewContext(rich)
    if (!ctx) return
    setRichViewContext(rich, { ...ctx, threads: response.threads })
  } catch {
    // Thread cards come in a later slice; ignore list failures for now.
  }
}
