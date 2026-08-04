import { describe, expect, it } from 'vitest'
import { markdownToDoc } from './index'
import { docToMarkdown } from './toMarkdown'

function roundTrip(source: string): string {
  return docToMarkdown(markdownToDoc(source)).trimEnd()
}

describe('docToMarkdown', () => {
  it('round-trips a plain paragraph', () => {
    expect(roundTrip('Hello world.\n')).toBe('Hello world.')
  })

  it('round-trips bold and italic', () => {
    expect(roundTrip('Say **hello** and *bye*.\n')).toContain('**hello**')
    expect(roundTrip('Say **hello** and *bye*.\n')).toContain('*bye*')
  })

  it('round-trips inline code', () => {
    expect(roundTrip('Use `code` here.\n')).toContain('`code`')
  })

  it('round-trips a link', () => {
    const out = roundTrip('See [docs](https://example.com).\n')
    expect(out).toContain('[docs](https://example.com)')
  })

  it('round-trips a bullet list', () => {
    const out = roundTrip('- one\n- two\n')
    expect(out).toMatch(/^- one/m)
    expect(out).toMatch(/^- two/m)
  })

  it('round-trips a fenced code block', () => {
    const out = roundTrip('```ts\nconst x = 1\n```\n')
    expect(out).toContain('```ts')
    expect(out).toContain('const x = 1')
  })

  it('round-trips a heading', () => {
    expect(roundTrip('## Section\n')).toMatch(/^## Section/)
  })

  it('round-trips strikethrough', () => {
    expect(roundTrip('This is ~~gone~~.\n')).toContain('~~gone~~')
  })
})
