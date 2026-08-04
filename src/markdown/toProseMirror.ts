import type {
  BlockContent,
  Content,
  Definition,
  Heading,
  List,
  ListItem,
  Nodes,
  Parents,
  PhrasingContent,
  Root,
  Table,
  TableCell,
  TableRow,
  YAML,
} from 'mdast'
import { Mark, type Node as PMNode } from 'prosemirror-model'
import { srcAttrsFromNode } from './positions'
import { markdownSchema } from './schema'

type Align = 'left' | 'right' | 'center' | null

/**
 * Convert an mdast tree into a ProseMirror document for `markdownSchema`.
 */
export function mdastToProseMirror(tree: Root): PMNode {
  const defs = collectDefinitions(tree)
  const blocks = tree.children
    .map((child) => blockToNode(child, defs))
    .filter((n): n is PMNode => n !== null)

  if (blocks.length === 0) {
    return markdownSchema.node('doc', null, [
      markdownSchema.node('paragraph', { srcFrom: null, srcTo: null }),
    ])
  }

  return markdownSchema.node('doc', null, blocks)
}

function collectDefinitions(tree: Root): Map<string, Definition> {
  const defs = new Map<string, Definition>()
  walk(tree, (node) => {
    if (node.type === 'definition') {
      defs.set(node.identifier.toLowerCase(), node)
    }
  })
  return defs
}

function walk(node: Nodes, visit: (node: Nodes) => void): void {
  visit(node)
  if ('children' in node && Array.isArray(node.children)) {
    for (const child of node.children as Nodes[]) {
      walk(child, visit)
    }
  }
}

function blockToNode(
  node: Content | BlockContent | YAML,
  defs: Map<string, Definition>,
): PMNode | null {
  const src = srcAttrsFromNode(node)

  switch (node.type) {
    case 'yaml':
      return markdownSchema.node('front_matter', {
        ...src,
        value: node.value,
      })

    case 'paragraph':
      return markdownSchema.node(
        'paragraph',
        src,
        phrasingToInline(node.children, defs),
      )

    case 'heading':
      return markdownSchema.node(
        'heading',
        { ...src, level: clampHeadingLevel(node) },
        phrasingToInline(node.children, defs),
      )

    case 'blockquote':
      return markdownSchema.node(
        'blockquote',
        src,
        childrenBlocks(node, defs),
      )

    case 'thematicBreak':
      return markdownSchema.node('horizontal_rule', src)

    case 'code':
      return markdownSchema.node(
        'code_block',
        { ...src, params: node.lang ?? '' },
        node.value ? [markdownSchema.text(node.value)] : [],
      )

    case 'list':
      return listToNode(node, defs)

    case 'table':
      return tableToNode(node, defs)

    case 'html':
      return markdownSchema.node('html_block', {
        ...src,
        html: node.value,
      })

    case 'definition':
    case 'footnoteDefinition':
      // Reference targets are resolved into links; defs are not rendered.
      return null

    default:
      // Unknown block → skip rather than fail the whole file.
      return null
  }
}

function clampHeadingLevel(node: Heading): number {
  const level = node.depth
  if (level < 1) return 1
  if (level > 6) return 6
  return level
}

function childrenBlocks(
  parent: Parents,
  defs: Map<string, Definition>,
): PMNode[] {
  const out: PMNode[] = []
  for (const child of parent.children) {
    const n = blockToNode(child as Content, defs)
    if (n) out.push(n)
  }
  if (out.length === 0) {
    out.push(
      markdownSchema.node('paragraph', { srcFrom: null, srcTo: null }),
    )
  }
  return out
}

function listToNode(node: List, defs: Map<string, Definition>): PMNode {
  const src = srcAttrsFromNode(node)
  const items = node.children.map((item) => listItemToNode(item, defs))
  if (node.ordered) {
    return markdownSchema.node(
      'ordered_list',
      {
        ...src,
        order: node.start ?? 1,
        tight: node.spread === false || node.spread === undefined,
      },
      items,
    )
  }
  return markdownSchema.node(
    'bullet_list',
    {
      ...src,
      tight: node.spread === false || node.spread === undefined,
    },
    items,
  )
}

function listItemToNode(
  node: ListItem,
  defs: Map<string, Definition>,
): PMNode {
  const src = srcAttrsFromNode(node)
  const checked =
    typeof node.checked === 'boolean' ? node.checked : null
  const content = childrenBlocks(node, defs)
  return markdownSchema.node('list_item', { ...src, checked }, content)
}

function tableToNode(node: Table, defs: Map<string, Definition>): PMNode {
  const src = srcAttrsFromNode(node)
  const aligns = node.align ?? []
  const rows = node.children.map((row, rowIndex) =>
    tableRowToNode(row, aligns, defs, rowIndex === 0),
  )
  return markdownSchema.node('table', src, rows)
}

function tableRowToNode(
  row: TableRow,
  aligns: Array<Align | undefined | null>,
  defs: Map<string, Definition>,
  isHeader: boolean,
): PMNode {
  const src = srcAttrsFromNode(row)
  const cells = row.children.map((cell, i) =>
    tableCellToNode(cell, aligns[i] ?? null, defs, isHeader),
  )
  return markdownSchema.node('table_row', src, cells)
}

function tableCellToNode(
  cell: TableCell,
  align: Align,
  defs: Map<string, Definition>,
  isHeader: boolean,
): PMNode {
  const src = srcAttrsFromNode(cell)
  const type = isHeader ? 'table_header' : 'table_cell'
  return markdownSchema.node(
    type,
    { ...src, align },
    phrasingToInline(cell.children, defs),
  )
}

function phrasingToInline(
  nodes: PhrasingContent[],
  defs: Map<string, Definition>,
  active: readonly Mark[] = [],
): PMNode[] {
  const out: PMNode[] = []
  for (const node of nodes) {
    out.push(...phrasingNode(node, defs, active))
  }
  return mergeAdjacentText(out)
}

function phrasingNode(
  node: PhrasingContent,
  defs: Map<string, Definition>,
  active: readonly Mark[],
): PMNode[] {
  switch (node.type) {
    case 'text':
      return node.value
        ? [markdownSchema.text(node.value, Mark.setFrom(active))]
        : []

    case 'inlineCode':
      return [
        markdownSchema.text(
          node.value,
          Mark.setFrom([
            ...active,
            markdownSchema.marks.code.create(),
          ]),
        ),
      ]

    case 'break':
      return [markdownSchema.node('hard_break')]

    case 'image':
      return [
        markdownSchema.node('image', {
          src: node.url,
          alt: node.alt ?? null,
          title: node.title ?? null,
        }),
      ]

    case 'imageReference': {
      const def = defs.get(node.identifier.toLowerCase())
      return [
        markdownSchema.node('image', {
          src: def?.url ?? '',
          alt: node.alt ?? null,
          title: def?.title ?? null,
        }),
      ]
    }

    case 'emphasis':
      return phrasingToInline(node.children, defs, [
        ...active,
        markdownSchema.marks.em.create(),
      ])

    case 'strong':
      return phrasingToInline(node.children, defs, [
        ...active,
        markdownSchema.marks.strong.create(),
      ])

    case 'delete':
      return phrasingToInline(node.children, defs, [
        ...active,
        markdownSchema.marks.strikethrough.create(),
      ])

    case 'link':
      return phrasingToInline(node.children, defs, [
        ...active,
        markdownSchema.marks.link.create({
          href: node.url,
          title: node.title ?? null,
        }),
      ])

    case 'linkReference': {
      const def = defs.get(node.identifier.toLowerCase())
      return phrasingToInline(node.children, defs, [
        ...active,
        markdownSchema.marks.link.create({
          href: def?.url ?? '',
          title: def?.title ?? null,
        }),
      ])
    }

    case 'html':
      // Inline HTML is kept as plain text so selection/anchors stay simple.
      return node.value
        ? [markdownSchema.text(node.value, Mark.setFrom(active))]
        : []

    case 'footnoteReference':
      return [
        markdownSchema.text(
          `[${node.identifier}]`,
          Mark.setFrom(active),
        ),
      ]

    default:
      return []
  }
}

function mergeAdjacentText(nodes: PMNode[]): PMNode[] {
  if (nodes.length < 2) return nodes
  const out: PMNode[] = []
  for (const node of nodes) {
    const prev = out[out.length - 1]
    if (
      prev?.isText &&
      node.isText &&
      Mark.sameSet(prev.marks, node.marks)
    ) {
      out[out.length - 1] = markdownSchema.text(
        (prev.text ?? '') + (node.text ?? ''),
        prev.marks,
      )
    } else {
      out.push(node)
    }
  }
  return out
}
