import type { Mark, Node as PMNode } from 'prosemirror-model'

/**
 * Serialize a ProseMirror document (markdownSchema) back to CommonMark/GFM.
 * Covers the comment-editor subset; exotic nodes fall back to plain text.
 */
export function docToMarkdown(doc: PMNode): string {
  const parts: string[] = []
  doc.forEach((child, _offset, index) => {
    if (index > 0) parts.push('\n\n')
    parts.push(serializeBlock(child, 0))
  })
  return parts.join('').replace(/\n{3,}/g, '\n\n').trimEnd() + (parts.length ? '\n' : '')
}

function serializeBlock(node: PMNode, listDepth: number): string {
  switch (node.type.name) {
    case 'paragraph':
      return serializeInline(node)
    case 'heading': {
      const level = Math.min(6, Math.max(1, Number(node.attrs.level) || 1))
      return `${'#'.repeat(level)} ${serializeInline(node)}`
    }
    case 'blockquote': {
      const inner = serializeChildrenBlocks(node, listDepth)
      return inner
        .split('\n')
        .map((line) => (line.length ? `> ${line}` : '>'))
        .join('\n')
    }
    case 'code_block': {
      const lang = String(node.attrs.params ?? '')
      const text = node.textContent
      return `\`\`\`${lang}\n${text}${text.endsWith('\n') ? '' : '\n'}\`\`\``
    }
    case 'bullet_list':
      return serializeList(node, listDepth, 'bullet')
    case 'ordered_list':
      return serializeList(node, listDepth, 'ordered')
    case 'horizontal_rule':
      return '---'
    case 'front_matter':
      return `---\n${String(node.attrs.value ?? '').trimEnd()}\n---`
    case 'html_block':
      return String(node.attrs.html ?? '')
    case 'table':
      return serializeTable(node)
    default:
      return serializeInline(node)
  }
}

function serializeChildrenBlocks(node: PMNode, listDepth: number): string {
  const parts: string[] = []
  node.forEach((child, _o, i) => {
    if (i > 0) parts.push('\n\n')
    parts.push(serializeBlock(child, listDepth))
  })
  return parts.join('')
}

function serializeList(
  node: PMNode,
  listDepth: number,
  kind: 'bullet' | 'ordered',
): string {
  const lines: string[] = []
  let index = Number(node.attrs.order ?? 1) || 1
  node.forEach((item) => {
    const checked = item.attrs.checked as boolean | null
    let marker: string
    if (checked === true) marker = '- [x]'
    else if (checked === false) marker = '- [ ]'
    else if (kind === 'ordered') marker = `${index}.`
    else marker = '-'

    const indent = '  '.repeat(listDepth)
    const body = serializeListItemBody(item, listDepth + 1)
    const bodyLines = body.split('\n')
    lines.push(`${indent}${marker} ${bodyLines[0] ?? ''}`)
    for (let i = 1; i < bodyLines.length; i++) {
      const line = bodyLines[i]!
      lines.push(line.length ? `${indent}  ${line}` : '')
    }
    index += 1
  })
  return lines.join('\n')
}

function serializeListItemBody(item: PMNode, nestedDepth: number): string {
  const parts: string[] = []
  item.forEach((child, _o, i) => {
    if (child.type.name === 'bullet_list' || child.type.name === 'ordered_list') {
      if (parts.length) parts.push('\n')
      parts.push(serializeBlock(child, nestedDepth))
      return
    }
    if (i > 0 && parts.length) parts.push('\n\n')
    parts.push(serializeBlock(child, nestedDepth))
  })
  return parts.join('')
}

function serializeTable(node: PMNode): string {
  const rows: string[][] = []
  node.forEach((row) => {
    const cells: string[] = []
    row.forEach((cell) => {
      cells.push(serializeInline(cell).replace(/\|/g, '\\|'))
    })
    rows.push(cells)
  })
  if (rows.length === 0) return ''
  const width = Math.max(...rows.map((r) => r.length))
  const pad = (r: string[]) => {
    const copy = [...r]
    while (copy.length < width) copy.push('')
    return copy
  }
  const header = pad(rows[0]!)
  const sep = header.map(() => '---')
  const out = [
    `| ${header.join(' | ')} |`,
    `| ${sep.join(' | ')} |`,
    ...rows.slice(1).map((r) => `| ${pad(r).join(' | ')} |`),
  ]
  return out.join('\n')
}

function serializeInline(node: PMNode): string {
  let out = ''
  node.forEach((child) => {
    if (child.isText) {
      out += serializeTextWithMarks(child.text ?? '', child.marks)
      return
    }
    if (child.type.name === 'hard_break') {
      out += '  \n'
      return
    }
    if (child.type.name === 'image') {
      const alt = String(child.attrs.alt ?? '')
      const src = String(child.attrs.src ?? '')
      const title = child.attrs.title
        ? ` "${String(child.attrs.title)}"`
        : ''
      out += `![${alt}](${src}${title})`
      return
    }
    out += serializeInline(child)
  })
  return out
}

function serializeTextWithMarks(text: string, marks: readonly Mark[]): string {
  if (!text) return ''
  const ordered = [...marks].sort((a, b) => {
    const rank = (m: Mark) =>
      m.type.name === 'code'
        ? 0
        : m.type.name === 'link'
          ? 1
          : m.type.name === 'strong'
            ? 2
            : m.type.name === 'em'
              ? 3
              : 4
    return rank(a) - rank(b)
  })

  let result = escapeMarkdownText(text, ordered.some((m) => m.type.name === 'code'))
  for (const mark of ordered) {
    switch (mark.type.name) {
      case 'code':
        result = wrapCode(result)
        break
      case 'strong':
        result = `**${result}**`
        break
      case 'em':
        result = `*${result}*`
        break
      case 'strikethrough':
        result = `~~${result}~~`
        break
      case 'link': {
        const href = String(mark.attrs.href ?? '')
        const title = mark.attrs.title
          ? ` "${String(mark.attrs.title)}"`
          : ''
        result = `[${result}](${href}${title})`
        break
      }
      default:
        break
    }
  }
  return result
}

function wrapCode(text: string): string {
  const ticks = text.includes('``') ? '```' : text.includes('`') ? '``' : '`'
  const pad = text.startsWith('`') || text.endsWith('`') ? ' ' : ''
  return `${ticks}${pad}${text}${pad}${ticks}`
}

function escapeMarkdownText(text: string, inCode: boolean): string {
  if (inCode) return text
  // Escape characters that would start unintended markdown constructs.
  return text
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
}
