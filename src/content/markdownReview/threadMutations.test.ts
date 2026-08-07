import { afterEach, describe, expect, it, vi } from 'vitest'
import { alignMarkdown } from '../../markdown/align'
import { getCommentEditorForTest } from './commentEditor'
import { renderRowsForTest } from './richView'
import { setRichViewContext } from './selection'
import { renderThreadCards } from './threads'

const text = 'Hello world.\n'

function mountThread(viewerLogin = 'hedger'): HTMLElement {
  const rows = alignMarkdown(text, text)
  const host = renderRowsForTest(rows, {
    baseText: text,
    headText: text,
    owner: 'o',
    repo: 'r',
    pullNumber: 1,
    path: 'README.md',
    viewerLogin,
  })
  document.body.appendChild(host)
  setRichViewContext(host, {
    baseText: text,
    headText: text,
    rows,
    owner: 'o',
    repo: 'r',
    pullNumber: 1,
    path: 'README.md',
    viewerLogin,
    threads: [
      {
        rootId: 10,
        path: 'README.md',
        side: 'RIGHT',
        startLine: 1,
        line: 1,
        pending: true,
        comments: [
          {
            id: 10,
            body: 'Root note',
            path: 'README.md',
            side: 'RIGHT',
            line: 1,
            startLine: 1,
            originalLine: null,
            inReplyToId: null,
            userLogin: 'hedger',
            createdAt: '2026-01-01T00:00:00Z',
            commitId: 'sha',
            htmlUrl: 'https://example.com',
            pullRequestReviewId: 7,
          },
        ],
      },
    ],
  })
  renderThreadCards(host)
  return host
}

afterEach(() => {
  document.body.innerHTML = ''
  document.documentElement.removeAttribute('data-rgm-comments-dirty')
  vi.restoreAllMocks()
})

describe('thread reply / edit / delete', () => {
  it('posts a reply and syncs', async () => {
    const sendMessage = vi.fn().mockImplementation(async (message: { type: string }) => {
      if (message.type === 'REPLY_REVIEW_COMMENT') {
        return {
          id: 11,
          body: 'A reply',
          path: 'README.md',
          side: 'RIGHT',
          line: 1,
          startLine: 1,
          originalLine: null,
          inReplyToId: 10,
          userLogin: 'hedger',
          createdAt: '2026-01-02T00:00:00Z',
          commitId: 'sha',
          htmlUrl: 'https://example.com',
          pullRequestReviewId: 7,
        }
      }
      if (message.type === 'FETCH_THREAD_INDEX') {
        return {
          owner: 'o',
          repo: 'r',
          pullNumber: 1,
          path: 'README.md',
          threads: [
            {
              rootId: 10,
              path: 'README.md',
              side: 'RIGHT',
              startLine: 1,
              line: 1,
              pending: true,
              comments: [
                {
                  id: 10,
                  body: 'Root note',
                  path: 'README.md',
                  side: 'RIGHT',
                  line: 1,
                  startLine: 1,
                  originalLine: null,
                  inReplyToId: null,
                  userLogin: 'hedger',
                  createdAt: '2026-01-01T00:00:00Z',
                  commitId: 'sha',
                  htmlUrl: 'https://example.com',
                  pullRequestReviewId: 7,
                },
                {
                  id: 11,
                  body: 'A reply',
                  path: 'README.md',
                  side: 'RIGHT',
                  line: 1,
                  startLine: 1,
                  originalLine: null,
                  inReplyToId: 10,
                  userLogin: 'hedger',
                  createdAt: '2026-01-02T00:00:00Z',
                  commitId: 'sha',
                  htmlUrl: 'https://example.com',
                  pullRequestReviewId: 7,
                },
              ],
            },
          ],
        }
      }
      return { error: `unexpected ${message.type}` }
    })
    vi.stubGlobal('chrome', { runtime: { sendMessage } })

    const host = mountThread()
    host.querySelectorAll('.rgm-thread-action').forEach((btn) => {
      if (btn.textContent === 'Reply') (btn as HTMLButtonElement).click()
    })

    await vi.waitFor(() => {
      expect(host.querySelector('.rgm-thread-reply')).not.toBeNull()
    })
    const editorHost = host.querySelector<HTMLElement>(
      '.rgm-thread-reply .rgm-comment-editor',
    )!
    getCommentEditorForTest(editorHost)!.setMarkdown('A reply')
    host
      .querySelector<HTMLButtonElement>('.rgm-thread-reply .rgm-composer-btn-primary')!
      .click()

    await vi.waitFor(() => {
      expect(host.querySelectorAll('.rgm-thread-comment')).toHaveLength(2)
    })
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'REPLY_REVIEW_COMMENT', inReplyToId: 10 }),
    )
  })

  it('edits an own comment and syncs', async () => {
    const sendMessage = vi.fn().mockImplementation(async (message: { type: string; body?: string }) => {
      if (message.type === 'UPDATE_REVIEW_COMMENT') {
        return {
          id: 10,
          body: message.body,
          path: 'README.md',
          side: 'RIGHT',
          line: 1,
          startLine: 1,
          originalLine: null,
          inReplyToId: null,
          userLogin: 'hedger',
          createdAt: '2026-01-01T00:00:00Z',
          commitId: 'sha',
          htmlUrl: 'https://example.com',
          pullRequestReviewId: 7,
        }
      }
      if (message.type === 'FETCH_THREAD_INDEX') {
        return {
          owner: 'o',
          repo: 'r',
          pullNumber: 1,
          path: 'README.md',
          threads: [
            {
              rootId: 10,
              path: 'README.md',
              side: 'RIGHT',
              startLine: 1,
              line: 1,
              pending: true,
              comments: [
                {
                  id: 10,
                  body: 'Updated body',
                  path: 'README.md',
                  side: 'RIGHT',
                  line: 1,
                  startLine: 1,
                  originalLine: null,
                  inReplyToId: null,
                  userLogin: 'hedger',
                  createdAt: '2026-01-01T00:00:00Z',
                  commitId: 'sha',
                  htmlUrl: 'https://example.com',
                  pullRequestReviewId: 7,
                },
              ],
            },
          ],
        }
      }
      return { error: `unexpected ${message.type}` }
    })
    vi.stubGlobal('chrome', { runtime: { sendMessage } })

    const host = mountThread()
    host.querySelectorAll('.rgm-thread-action').forEach((btn) => {
      if (btn.textContent === 'Edit') (btn as HTMLButtonElement).click()
    })

    await vi.waitFor(() => {
      expect(host.querySelector('.rgm-thread-edit')).not.toBeNull()
    })
    const editorHost = host.querySelector<HTMLElement>(
      '.rgm-thread-edit .rgm-comment-editor',
    )!
    getCommentEditorForTest(editorHost)!.setMarkdown('Updated body')
    host
      .querySelector<HTMLButtonElement>('.rgm-thread-edit .rgm-composer-btn-primary')!
      .click()

    await vi.waitFor(() => {
      expect(host.textContent).toContain('Updated body')
    })
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'UPDATE_REVIEW_COMMENT',
        commentId: 10,
        // Needed so the background can find pending drafts via GraphQL.
        pullNumber: 1,
        body: 'Updated body',
      }),
    )
  })

  it('deletes an own comment after confirm', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const sendMessage = vi.fn().mockImplementation(async (message: { type: string }) => {
      if (message.type === 'DELETE_REVIEW_COMMENT') {
        return { ok: true }
      }
      if (message.type === 'FETCH_THREAD_INDEX') {
        return {
          owner: 'o',
          repo: 'r',
          pullNumber: 1,
          path: 'README.md',
          threads: [],
        }
      }
      return { error: `unexpected ${message.type}` }
    })
    vi.stubGlobal('chrome', { runtime: { sendMessage } })

    const host = mountThread()
    host.querySelectorAll('.rgm-thread-action').forEach((btn) => {
      if (btn.textContent === 'Delete') (btn as HTMLButtonElement).click()
    })

    await vi.waitFor(() => {
      expect(host.querySelector('[data-rgm-thread-card]')).toBeNull()
    })
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'DELETE_REVIEW_COMMENT',
        commentId: 10,
        pullNumber: 1,
      }),
    )
  })
})

describe('stale page state after a mutation', () => {
  /** Mount a thread, answer confirm, and click its Delete button. */
  function deleteWith(
    fetchIndex: () => unknown,
  ): { host: HTMLElement; sendMessage: ReturnType<typeof vi.fn> } {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.spyOn(window, 'alert').mockImplementation(() => {})
    const sendMessage = vi
      .fn()
      .mockImplementation(async (message: { type: string }) => {
        if (message.type === 'DELETE_REVIEW_COMMENT') return { ok: true }
        if (message.type === 'FETCH_THREAD_INDEX') return fetchIndex()
        return { error: `unexpected ${message.type}` }
      })
    vi.stubGlobal('chrome', { runtime: { sendMessage } })

    const host = mountThread()
    host.querySelectorAll('.rgm-thread-action').forEach((btn) => {
      if (btn.textContent === 'Delete') (btn as HTMLButtonElement).click()
    })
    return { host, sendMessage }
  }

  it('offers a refresh once the delete lands', async () => {
    const { host } = deleteWith(() => ({ threads: [] }))

    await vi.waitFor(() => {
      expect(host.querySelector('[data-rgm-thread-card]')).toBeNull()
    })
    expect(host.querySelector('[data-rgm-stale-notice]')).not.toBeNull()
  })

  it('offers a refresh even when the follow-up sync fails', async () => {
    // The comment is already gone from GitHub. A sync that cannot confirm it
    // must not leave the page silently stale.
    const { host, sendMessage } = deleteWith(() => ({ error: 'network down' }))

    await vi.waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'FETCH_THREAD_INDEX' }),
      )
    })
    expect(host.querySelector('[data-rgm-stale-notice]')).not.toBeNull()
    expect(
      document.documentElement.hasAttribute('data-rgm-comments-dirty'),
    ).toBe(true)
  })
})
