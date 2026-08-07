import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  commentIdFromHash,
  focusCommentFromHash,
  followCommentHash,
  resetCommentAnchorForTests,
} from './commentAnchor'

/**
 * Build a rich view holding one thread card, the way renderThreadCards does:
 * the card carries the thread id, each comment block carries its own id.
 * @param threadId - The root comment id of the thread.
 * @param commentIds - Every comment in the thread, root first.
 * @returns The rich root element.
 */
function richRootWithThread(
  threadId: number,
  commentIds: number[],
): HTMLElement {
  const root = document.createElement('div')
  root.setAttribute('data-rgm-rich', '')

  const card = document.createElement('div')
  card.setAttribute('data-rgm-thread-card', '')
  card.setAttribute('data-thread-id', String(threadId))

  const detail = document.createElement('div')
  detail.className = 'rgm-thread-detail'
  detail.hidden = true
  for (const id of commentIds) {
    const block = document.createElement('div')
    block.setAttribute('data-comment-id', String(id))
    block.textContent = `comment ${id}`
    detail.appendChild(block)
  }

  const show = document.createElement('button')
  show.className = 'rgm-thread-show'
  show.textContent = 'Show'

  card.append(show, detail)
  root.appendChild(card)
  document.body.appendChild(root)
  return root
}

describe('commentIdFromHash', () => {
  it('reads the id from a GitHub comment anchor', () => {
    expect(commentIdFromHash('#r3732864509')).toBe('3732864509')
  })

  it('ignores hashes that are not comment anchors', () => {
    for (const hash of ['', '#', '#diff-abc', '#issuecomment-12', '#r', '#rxyz']) {
      expect(commentIdFromHash(hash)).toBeNull()
    }
  })
})

describe('focusCommentFromHash', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('scrolls to the card holding the comment', () => {
    const root = richRootWithThread(700, [700])
    const card = root.querySelector('[data-rgm-thread-card]')!

    expect(focusCommentFromHash('#r700')).toBe(true)
    expect(card.classList.contains('rgm-thread-card-flash')).toBe(true)
  })

  it('resolves a reply to the thread that contains it', () => {
    // The hash names a reply, not the thread root.
    const root = richRootWithThread(700, [700, 701, 702])
    const card = root.querySelector('[data-rgm-thread-card]')!

    expect(focusCommentFromHash('#r702')).toBe(true)
    expect(card.classList.contains('rgm-thread-card-flash')).toBe(true)
  })

  it('expands a collapsed thread so the comment is readable', () => {
    const root = richRootWithThread(700, [700, 701])
    const detail = root.querySelector<HTMLElement>('.rgm-thread-detail')!
    expect(detail.hidden).toBe(true)

    focusCommentFromHash('#r701')

    expect(detail.hidden).toBe(false)
    expect(root.querySelector('.rgm-thread-show')?.textContent).toBe('Hide')
  })

  it('reports no match for a comment that is not rendered', () => {
    richRootWithThread(700, [700])

    expect(focusCommentFromHash('#r999')).toBe(false)
  })

  it('ignores comments outside a rich view', () => {
    const stray = document.createElement('div')
    stray.setAttribute('data-comment-id', '700')
    document.body.appendChild(stray)

    expect(focusCommentFromHash('#r700')).toBe(false)
  })

  it('does nothing for a hash that is not a comment anchor', () => {
    richRootWithThread(700, [700])

    expect(focusCommentFromHash('#diff-something')).toBe(false)
  })
})

describe('followCommentHash', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    resetCommentAnchorForTests()
    location.hash = ''
  })

  afterEach(() => {
    resetCommentAnchorForTests()
    location.hash = ''
  })

  it('waits for the thread cards to render', async () => {
    location.hash = '#r700'
    followCommentHash()

    // Cards arrive only after the snapshot and thread index load.
    const root = richRootWithThread(700, [700])

    await vi.waitFor(() => {
      expect(
        root
          .querySelector('[data-rgm-thread-card]')
          ?.classList.contains('rgm-thread-card-flash'),
      ).toBe(true)
    })
  })

  it('stays idle when the hash names no comment', async () => {
    location.hash = '#diff-abc'
    followCommentHash()
    const root = richRootWithThread(700, [700])

    await new Promise((resolve) => setTimeout(resolve, 400))
    expect(
      root
        .querySelector('[data-rgm-thread-card]')
        ?.classList.contains('rgm-thread-card-flash'),
    ).toBe(false)
  })
})
