import { DOMSerializer, type Node as PMNode } from 'prosemirror-model'
import { emptyDoc, markdownToDoc, markdownSchema } from '../../markdown'
import { docToMarkdown } from '../../markdown/toMarkdown'

const serializer = DOMSerializer.fromSchema(markdownSchema)

/**
 * Render a markdown string to a read-only DOM fragment for thread cards.
 * @param markdown - Raw markdown text to render.
 * @returns A DocumentFragment containing the rendered HTML.
 */
export function renderMarkdownBody(markdown: string): DocumentFragment {
  const frag = document.createDocumentFragment()
  const wrap = document.createElement('div')
  wrap.className = 'rgm-md-body'
  const source = markdown.trim() ? markdown : ''
  if (!source) {
    const empty = document.createElement('p')
    empty.className = 'rgm-md-empty'
    empty.textContent = ''
    wrap.appendChild(empty)
    frag.appendChild(wrap)
    return frag
  }
  try {
    const doc = markdownToDoc(source)
    doc.forEach((child) => {
      const dom = serializer.serializeNode(child)
      wrap.appendChild(dom)
    })
  } catch {
    const pre = document.createElement('pre')
    pre.className = 'rgm-md-fallback'
    pre.textContent = source
    wrap.appendChild(pre)
  }
  frag.appendChild(wrap)
  return frag
}

/**
 * Parse a markdown string into a ProseMirror document node.
 * Returns an empty document when the input is blank or parsing fails.
 * @param markdown - Raw markdown text to parse.
 * @returns A ProseMirror document node.
 */
export function docFromMarkdown(markdown: string): PMNode {
  const trimmed = markdown.trim()
  if (!trimmed) return emptyDoc()
  try {
    return markdownToDoc(trimmed)
  } catch {
    return markdownSchema.node('doc', null, [
      markdownSchema.node('paragraph', { srcFrom: null, srcTo: null }, [
        markdownSchema.text(trimmed),
      ]),
    ])
  }
}

export { docToMarkdown }
