import { beforeEach, describe, expect, it, vi } from 'vitest'
import { alignMarkdown } from '../../markdown/align'
import { getCommentEditorForTest } from './commentEditor'
import { bindComposer } from './composer'
import { renderRowsForTest } from './richView'
import { setRichMode } from './richStub'
import { createFileRegion } from './test/fixtures'

function selectNeedle(root: Element, needle: string): void {
  const contents = [
    ...root.querySelectorAll('.rgm-rich-cell-after .rgm-rich-content'),
  ]
  for (const content of contents) {
    const parts: { node: Text; text: string }[] = []
    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT)
    let node = walker.nextNode()
    while (node) {
      if (!node.parentElement?.closest('[data-rgm-chrome]')) {
        parts.push({ node: node as Text, text: node.textContent ?? '' })
      }
      node = walker.nextNode()
    }
    const joined = parts.map((p) => p.text).join('')
    const start = joined.indexOf(needle)
    if (start < 0) continue
    const end = start + needle.length
    let seen = 0
    let startNode: Text | null = null
    let startOffset = 0
    let endNode: Text | null = null
    let endOffset = 0
    for (const part of parts) {
      const next = seen + part.text.length
      if (startNode == null && start < next) {
        startNode = part.node
        startOffset = start - seen
      }
      if (end <= next) {
        endNode = part.node
        endOffset = end - seen
        break
      }
      seen = next
    }
    if (!startNode || !endNode) continue
    const range = document.createRange()
    range.setStart(startNode, startOffset)
    range.setEnd(endNode, endOffset)
    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)
    return
  }
  throw new Error(`needle not found: ${needle}`)
}

describe('bindComposer', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  it('shows a Comment bubble after selecting text', async () => {
    const baseText = '# Title\n\nOld.\n'
    const headText = '# Title\n\nNew line.\n'
    const rows = alignMarkdown(baseText, headText)
    const host = renderRowsForTest(rows, {
      baseText,
      headText,
      owner: 'o',
      repo: 'r',
      pullNumber: 1,
      path: 'docs/PLAN.md',
      baseSha: 'aaa',
      headSha: 'bbb',
    })
    document.body.appendChild(host)
    bindComposer(host)

    selectNeedle(host, 'New line')
    host.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))

    await vi.waitFor(() => {
      expect(host.querySelector('[data-rgm-comment-bubble]')).not.toBeNull()
    })
    expect(host.querySelector('[data-rgm-composer]')).toBeNull()
    expect(host.textContent).toContain('Comment')
    expect(host.textContent).toMatch(/L\d+/)
  })

  it('clears the highlight when clicking off collapses the selection', async () => {
    const baseText = '# Title\n\nOld.\n'
    const headText = '# Title\n\nNew line.\n'
    const rows = alignMarkdown(baseText, headText)
    const host = renderRowsForTest(rows, {
      baseText,
      headText,
      owner: 'o',
      repo: 'r',
      pullNumber: 1,
      path: 'docs/PLAN.md',
      baseSha: 'aaa',
      headSha: 'bbb',
    })
    document.body.appendChild(host)
    bindComposer(host)

    selectNeedle(host, 'New line')
    host.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    await vi.waitFor(() => {
      expect(host.querySelector('[data-rgm-sel-highlight]')).not.toBeNull()
    })

    // Click off: the browser collapses the selection before mouseup fires.
    window.getSelection()!.removeAllRanges()
    host.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))

    await vi.waitFor(() => {
      expect(host.querySelector('[data-rgm-sel-highlight]')).toBeNull()
    })
    expect(host.querySelector('.rgm-sel-highlight-cell')).toBeNull()
    expect(host.querySelector('[data-rgm-comment-bubble]')).toBeNull()
  })

  it('keeps the highlight on collapsed-selection clicks while the composer is open', async () => {
    vi.stubGlobal('chrome', { runtime: { sendMessage: vi.fn() } })
    const baseText = 'Hello world.\n'
    const headText = 'Hello world.\n'
    const rows = alignMarkdown(baseText, headText)
    const host = renderRowsForTest(rows, {
      baseText,
      headText,
      owner: 'o',
      repo: 'r',
      pullNumber: 7,
      path: 'README.md',
      headSha: 'bbb',
    })
    document.body.appendChild(host)
    bindComposer(host)

    selectNeedle(host, 'Hello')
    host.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    await vi.waitFor(() => {
      expect(host.querySelector('[data-rgm-comment-bubble]')).not.toBeNull()
    })
    host
      .querySelector<HTMLButtonElement>(
        '[data-rgm-comment-bubble] .rgm-comment-bubble-btn',
      )!
      .click()
    await vi.waitFor(() => {
      expect(host.querySelector('[data-rgm-composer]')).not.toBeNull()
    })

    // Clicking into the textarea collapses the selection; anchor must stay.
    window.getSelection()!.removeAllRanges()
    host.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))

    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(host.querySelector('[data-rgm-sel-highlight]')).not.toBeNull()
    expect(host.querySelector('[data-rgm-composer]')).not.toBeNull()
  })

  it('ignores text selection inside the comment editor', async () => {
    vi.stubGlobal('chrome', { runtime: { sendMessage: vi.fn() } })
    const baseText = 'Hello world.\n'
    const headText = 'Hello world.\n'
    const rows = alignMarkdown(baseText, headText)
    const host = renderRowsForTest(rows, {
      baseText,
      headText,
      owner: 'o',
      repo: 'r',
      pullNumber: 7,
      path: 'README.md',
      headSha: 'bbb',
    })
    document.body.appendChild(host)
    bindComposer(host)

    selectNeedle(host, 'Hello')
    host.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    await vi.waitFor(() => {
      expect(host.querySelector('[data-rgm-comment-bubble]')).not.toBeNull()
    })
    host
      .querySelector<HTMLButtonElement>(
        '[data-rgm-comment-bubble] .rgm-comment-bubble-btn',
      )!
      .click()
    await vi.waitFor(() => {
      expect(host.querySelector('[data-rgm-composer]')).not.toBeNull()
    })

    const editorHost = host.querySelector<HTMLElement>('.rgm-comment-editor')!
    const editor = getCommentEditorForTest(editorHost)!
    editor.setMarkdown('Select this comment text')

    const content = editorHost.querySelector('.rgm-comment-editor-content')!
    const textNode = [...content.childNodes].find(
      (n) => n.nodeType === Node.TEXT_NODE || n.textContent?.includes('Select'),
    )
    expect(textNode).toBeTruthy()

    // Select inside the editor (walk to a text node).
    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT)
    const firstText = walker.nextNode() as Text | null
    expect(firstText).not.toBeNull()
    const range = document.createRange()
    range.setStart(firstText!, 0)
    range.setEnd(firstText!, Math.min(6, firstText!.data.length))
    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)

    host.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(host.querySelector('[data-rgm-composer]')).not.toBeNull()
    expect(host.querySelector('[data-rgm-comment-bubble]')).toBeNull()
    expect(selection.toString().length).toBeGreaterThan(0)
    expect(editorHost.contains(selection.anchorNode)).toBe(true)
  })

  it('opens the composer from the Comment bubble and posts', async () => {
    const created = {
      id: 99,
      body: 'Looks good',
      path: 'docs/PLAN.md',
      side: 'RIGHT' as const,
      line: 1,
      startLine: null,
      originalLine: null,
      inReplyToId: null,
      userLogin: 'alice',
      createdAt: '2026-01-01T00:00:00Z',
      commitId: 'bbb',
      htmlUrl: 'https://example.com',
      pullRequestReviewId: 7,
    }
    const sendMessage = vi.fn().mockImplementation(async (message: { type: string }) => {
      if (message.type === 'CREATE_REVIEW_COMMENT') {
        return created
      }
      if (message.type === 'FETCH_THREAD_INDEX') {
        return {
          owner: 'o',
          repo: 'r',
          pullNumber: 7,
          path: 'README.md',
          threads: [
            {
              rootId: 99,
              path: 'README.md',
              side: 'RIGHT',
              startLine: 1,
              line: 1,
              pending: true,
              comments: [{ ...created, path: 'README.md' }],
            },
          ],
        }
      }
      return { error: `unexpected ${message.type}` }
    })
    vi.stubGlobal('chrome', {
      runtime: { sendMessage },
    })

    const baseText = 'Hello world.\n'
    const headText = 'Hello world.\n'
    const rows = alignMarkdown(baseText, headText)
    const host = renderRowsForTest(rows, {
      baseText,
      headText,
      owner: 'o',
      repo: 'r',
      pullNumber: 7,
      path: 'README.md',
      headSha: 'bbb',
    })
    document.body.appendChild(host)
    bindComposer(host)

    selectNeedle(host, 'Hello')
    host.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))

    await vi.waitFor(() => {
      expect(host.querySelector('[data-rgm-comment-bubble]')).not.toBeNull()
    })

    host
      .querySelector<HTMLButtonElement>(
        '[data-rgm-comment-bubble] .rgm-comment-bubble-btn',
      )!
      .click()

    await vi.waitFor(() => {
      expect(host.querySelector('[data-rgm-composer]')).not.toBeNull()
    })
    expect(host.querySelector('[data-rgm-comment-bubble]')).toBeNull()
    expect(host.textContent).toContain('Anchored to')
    expect(host.textContent).toContain('README.md')
    expect(host.querySelector('.rgm-composer-quote')).toBeNull()
    expect(host.querySelector('[data-rgm-sel-highlight]')).not.toBeNull()
    expect(host.textContent).not.toMatch(/“Hello/)

    const composer = host.querySelector<HTMLElement>('[data-rgm-composer]')!
    expect(composer.parentElement).toBe(host)
    expect(composer.style.top).not.toBe('')
    expect(composer.style.left).not.toBe('')

    const editorHost = host.querySelector<HTMLElement>('.rgm-comment-editor')!
    getCommentEditorForTest(editorHost)!.setMarkdown('Looks good')
    host.querySelector<HTMLButtonElement>('.rgm-composer-btn-primary')!.click()

    await vi.waitFor(() => {
      expect(sendMessage).toHaveBeenCalled()
    })

    expect(sendMessage.mock.calls[0]![0]).toMatchObject({
      type: 'CREATE_REVIEW_COMMENT',
      owner: 'o',
      repo: 'r',
      pullNumber: 7,
      path: 'README.md',
      body: 'Looks good',
      commitId: 'bbb',
      side: 'RIGHT',
      line: 1,
    })

    await vi.waitFor(() => {
      expect(host.querySelector('[data-rgm-thread-card]')).not.toBeNull()
    })
    expect(host.textContent).toContain('Looks good')
    expect(host.textContent).toContain('Pending')
    expect(document.documentElement.hasAttribute('data-rgm-comments-dirty')).toBe(
      true,
    )
    expect(
      sendMessage.mock.calls.some(
        (call) => call[0]?.type === 'FETCH_THREAD_INDEX',
      ),
    ).toBe(true)
  })

  it('reloads the page when leaving rich mode after posting a comment', () => {
    const reload = vi.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload },
    })

    const region = createFileRegion({ path: 'README.md' })
    document.body.appendChild(region)
    region.setAttribute('data-rgm-mode', 'rich')
    document.documentElement.setAttribute('data-rgm-comments-dirty', '')

    setRichMode(region, false)

    expect(reload).toHaveBeenCalled()
    expect(document.documentElement.hasAttribute('data-rgm-comments-dirty')).toBe(
      false,
    )
  })
})
