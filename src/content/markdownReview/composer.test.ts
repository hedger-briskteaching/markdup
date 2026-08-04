import { beforeEach, describe, expect, it, vi } from 'vitest'
import { alignMarkdown } from '../../markdown/align'
import { bindComposer } from './composer'
import { renderRowsForTest } from './richView'

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

  it('opens a composer after selecting text when PR context is set', async () => {
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
      expect(host.querySelector('[data-rgm-composer]')).not.toBeNull()
    })
    expect(host.textContent).toContain('After · line')
    expect(host.textContent).toContain('New line')
  })

  it('posts CREATE_REVIEW_COMMENT on submit', async () => {
    const sendMessage = vi.fn().mockResolvedValue({
      id: 99,
      body: 'Looks good',
      path: 'docs/PLAN.md',
      side: 'RIGHT',
      line: 3,
      startLine: null,
      originalLine: null,
      inReplyToId: null,
      userLogin: 'alice',
      createdAt: '2026-01-01T00:00:00Z',
      commitId: 'bbb',
      htmlUrl: 'https://example.com',
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
      expect(host.querySelector('[data-rgm-composer]')).not.toBeNull()
    })

    const textarea = host.querySelector<HTMLTextAreaElement>(
      '.rgm-composer-input',
    )!
    textarea.value = 'Looks good'
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
  })
})
