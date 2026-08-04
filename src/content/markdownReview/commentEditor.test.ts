import { afterEach, describe, expect, it } from 'vitest'
import {
  getCommentEditorForTest,
  mountCommentEditor,
} from './commentEditor'

afterEach(() => {
  document.body.innerHTML = ''
})

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
})
