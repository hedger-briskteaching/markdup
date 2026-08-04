import { TextSelection } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import {
  getCommentEditorForTest,
  mountCommentEditor,
} from './commentEditor'
import { injectStyles } from './styles'

beforeAll(() => {
  // jsdom lacks layout APIs ProseMirror uses when updating the selection.
  const emptyRects = () => [] as unknown as DOMRectList
  const emptyBox = () =>
    ({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      toJSON() {
        return {}
      },
    }) as DOMRect
  for (const proto of [Range.prototype, Element.prototype]) {
    const p = proto as unknown as {
      getClientRects?: () => DOMRectList
      getBoundingClientRect?: () => DOMRect
    }
    if (typeof p.getClientRects !== 'function') p.getClientRects = emptyRects
    if (typeof p.getBoundingClientRect !== 'function') {
      p.getBoundingClientRect = emptyBox
    }
  }
})

afterEach(() => {
  document.body.innerHTML = ''
  document.getElementById('rgm-markdown-review-styles')?.remove()
})

/** Type through ProseMirror's handleTextInput so input rules run. */
function typeText(view: EditorView, text: string): void {
  for (const ch of text) {
    const { from, to } = view.state.selection
    const handled = view.someProp('handleTextInput', (f) =>
      f(view, from, to, ch),
    )
    if (!handled) {
      view.dispatch(view.state.tr.insertText(ch, from, to))
    }
  }
}

describe('mountCommentEditor', () => {
  it('round-trips markdown through getMarkdown / setMarkdown', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const editor = mountCommentEditor(host, {
      initialMarkdown: 'Hello **world**.',
    })

    expect(editor.getMarkdown()).toContain('**world**')
    editor.setMarkdown('Use `code` please.')
    expect(editor.getMarkdown()).toContain('`code`')
    expect(getCommentEditorForTest(host)).toBe(editor)
    editor.destroy()
    expect(getCommentEditorForTest(host)).toBeUndefined()
  })

  it('omits Link, Paragraph, and Italic toolbar controls', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    mountCommentEditor(host)

    const labels = [
      ...host.querySelectorAll<HTMLButtonElement>('.rgm-comment-editor-btn'),
    ].map((b) => b.getAttribute('aria-label') ?? '')

    expect(labels.some((l) => /link/i.test(l))).toBe(false)
    expect(labels.some((l) => /^paragraph$/i.test(l))).toBe(false)
    expect(labels.some((l) => /italic/i.test(l))).toBe(false)
    expect(labels.some((l) => /inline code/i.test(l))).toBe(true)
    expect(labels.some((l) => /code block/i.test(l))).toBe(true)
    expect(labels.some((l) => /bulleted list/i.test(l))).toBe(true)
  })

  it('exposes a visible data-tooltip on each toolbar button', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    mountCommentEditor(host)

    const buttons = [
      ...host.querySelectorAll<HTMLButtonElement>('.rgm-comment-editor-btn'),
    ]
    expect(buttons.length).toBeGreaterThan(0)
    for (const button of buttons) {
      expect(button.getAttribute('data-tooltip')?.length).toBeGreaterThan(0)
      expect(button.getAttribute('data-tooltip')).toBe(
        button.getAttribute('aria-label'),
      )
    }
  })

  it('toggles a code block back to a paragraph', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const editor = mountCommentEditor(host, { initialMarkdown: 'Hello' })
    const codeBlockBtn = [
      ...host.querySelectorAll<HTMLButtonElement>('.rgm-comment-editor-btn'),
    ].find((b) => (b.getAttribute('aria-label') ?? '').includes('Code block'))!

    codeBlockBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(editor.view.state.selection.$from.parent.type.name).toBe('code_block')

    codeBlockBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(editor.view.state.selection.$from.parent.type.name).toBe('paragraph')
  })

  it('toggles a bulleted list on and off', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const editor = mountCommentEditor(host, { initialMarkdown: 'Item' })
    const bulletBtn = [
      ...host.querySelectorAll<HTMLButtonElement>('.rgm-comment-editor-btn'),
    ].find((b) =>
      (b.getAttribute('aria-label') ?? '').includes('Bulleted list'),
    )!

    bulletBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(editor.getMarkdown()).toMatch(/^[-*] /m)

    bulletBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(editor.getMarkdown()).not.toMatch(/^[-*] /m)
  })

  it('switches a bulleted list to a numbered list', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const editor = mountCommentEditor(host, { initialMarkdown: 'Item' })
    const buttons = [
      ...host.querySelectorAll<HTMLButtonElement>('.rgm-comment-editor-btn'),
    ]
    const bulletBtn = buttons.find((b) =>
      (b.getAttribute('aria-label') ?? '').includes('Bulleted list'),
    )!
    const numberedBtn = buttons.find((b) =>
      (b.getAttribute('aria-label') ?? '').includes('Numbered list'),
    )!

    bulletBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(editor.getMarkdown()).toMatch(/^[-*] /m)

    numberedBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(editor.getMarkdown()).toMatch(/^\d+\. /m)
    expect(editor.getMarkdown()).not.toMatch(/^[-*] /m)
  })

  it('switches a list into a quote', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const editor = mountCommentEditor(host, { initialMarkdown: 'Item' })
    const buttons = [
      ...host.querySelectorAll<HTMLButtonElement>('.rgm-comment-editor-btn'),
    ]
    const bulletBtn = buttons.find((b) =>
      (b.getAttribute('aria-label') ?? '').includes('Bulleted list'),
    )!
    const quoteBtn = buttons.find((b) =>
      (b.getAttribute('aria-label') ?? '').includes('Block quote'),
    )!

    bulletBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    quoteBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(editor.getMarkdown()).toMatch(/^>/m)
  })

  it('converts `foo` typed markdown into an inline code mark', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const editor = mountCommentEditor(host)
    const { view } = editor
    // Empty doc: place caret inside the paragraph (pos 1).
    view.dispatch(
      view.state.tr.setSelection(TextSelection.create(view.state.doc, 1)),
    )
    typeText(view, '`foo`')

    expect(editor.getMarkdown()).toContain('`foo`')
    const codeMark = view.state.schema.marks.code!
    let hasCode = false
    view.state.doc.descendants((node) => {
      if (node.isText && codeMark.isInSet(node.marks)) {
        hasCode = true
      }
    })
    expect(hasCode).toBe(true)
  })

  it('highlights bold and inline code when the whole selection has the mark', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const editor = mountCommentEditor(host, {
      initialMarkdown: 'Hello **world** and `code`.',
    })
    const { view } = editor
    const boldBtn = host.querySelector<HTMLButtonElement>(
      '.rgm-comment-editor-btn[data-mark="strong"]',
    )!
    const codeBtn = host.querySelector<HTMLButtonElement>(
      '.rgm-comment-editor-btn[data-mark="code"]',
    )!

    // Select only "world" (bold).
    let worldFrom = -1
    let worldTo = -1
    view.state.doc.descendants((node, pos) => {
      if (node.isText && node.text === 'world') {
        worldFrom = pos
        worldTo = pos + node.nodeSize
      }
    })
    view.dispatch(
      view.state.tr.setSelection(
        TextSelection.create(view.state.doc, worldFrom, worldTo),
      ),
    )
    expect(boldBtn.classList.contains('is-active')).toBe(true)
    expect(boldBtn.getAttribute('aria-pressed')).toBe('true')
    expect(codeBtn.classList.contains('is-active')).toBe(false)

    // Select only "code" (inline code).
    let codeFrom = -1
    let codeTo = -1
    view.state.doc.descendants((node, pos) => {
      if (node.isText && node.text === 'code') {
        codeFrom = pos
        codeTo = pos + node.nodeSize
      }
    })
    view.dispatch(
      view.state.tr.setSelection(
        TextSelection.create(view.state.doc, codeFrom, codeTo),
      ),
    )
    expect(codeBtn.classList.contains('is-active')).toBe(true)
    expect(codeBtn.getAttribute('aria-pressed')).toBe('true')
    expect(boldBtn.classList.contains('is-active')).toBe(false)

    // Select mixed range spanning bold + plain — bold should not be active.
    view.dispatch(
      view.state.tr.setSelection(
        TextSelection.create(view.state.doc, worldFrom, worldTo + 2),
      ),
    )
    expect(boldBtn.classList.contains('is-active')).toBe(false)
  })

  it('includes list padding and inline code styles for the comment editor', () => {
    injectStyles()
    const css = document.getElementById('rgm-markdown-review-styles')?.textContent
    expect(css).toContain('.rgm-comment-editor-content ul')
    expect(css).toContain('padding-left: 1.5em')
    expect(css).toContain('.rgm-comment-editor-content code')
    expect(css).toContain('ui-monospace')
  })
})
