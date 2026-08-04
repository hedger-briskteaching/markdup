import { Schema, type MarkSpec, type NodeSpec } from 'prosemirror-model'
import { SRC_RANGE_ATTRS } from './positions'

/**
 * ProseMirror schema for GitHub Markdown review.
 *
 * Covers CommonMark, GFM (tables, task lists, strikethrough), YAML front matter,
 * and HTML blocks. Source line attrs (`srcFrom` / `srcTo`) sit on block nodes.
 */
const blockWithSrc = (spec: NodeSpec): NodeSpec => ({
  ...spec,
  attrs: {
    ...SRC_RANGE_ATTRS,
    ...(spec.attrs ?? {}),
  },
})

export const markdownSchema = new Schema({
  nodes: {
    doc: {
      content: 'block+',
    },

    paragraph: blockWithSrc({
      content: 'inline*',
      group: 'block',
      parseDOM: [{ tag: 'p' }],
      toDOM() {
        return ['p', 0]
      },
    }),

    blockquote: blockWithSrc({
      content: 'block+',
      group: 'block',
      defining: true,
      parseDOM: [{ tag: 'blockquote' }],
      toDOM() {
        return ['blockquote', 0]
      },
    }),

    horizontal_rule: blockWithSrc({
      group: 'block',
      parseDOM: [{ tag: 'hr' }],
      toDOM() {
        return ['hr']
      },
    }),

    heading: blockWithSrc({
      attrs: {
        level: { default: 1 },
      },
      content: 'inline*',
      group: 'block',
      defining: true,
      parseDOM: [
        { tag: 'h1', attrs: { level: 1 } },
        { tag: 'h2', attrs: { level: 2 } },
        { tag: 'h3', attrs: { level: 3 } },
        { tag: 'h4', attrs: { level: 4 } },
        { tag: 'h5', attrs: { level: 5 } },
        { tag: 'h6', attrs: { level: 6 } },
      ],
      toDOM(node) {
        return [`h${node.attrs.level as number}`, 0]
      },
    }),

    code_block: blockWithSrc({
      content: 'text*',
      marks: '',
      group: 'block',
      code: true,
      defining: true,
      attrs: {
        params: { default: '' },
      },
      parseDOM: [
        {
          tag: 'pre',
          preserveWhitespace: 'full',
          getAttrs(dom) {
            const el = dom as HTMLElement
            return { params: el.getAttribute('data-params') ?? '' }
          },
        },
      ],
      toDOM(node) {
        const params = node.attrs.params as string
        return [
          'pre',
          params ? { 'data-params': params } : {},
          ['code', 0],
        ]
      },
    }),

    ordered_list: blockWithSrc({
      content: 'list_item+',
      group: 'block',
      attrs: {
        order: { default: 1 },
        tight: { default: true },
      },
      parseDOM: [
        {
          tag: 'ol',
          getAttrs(dom) {
            const el = dom as HTMLElement
            return {
              order: el.hasAttribute('start')
                ? Number(el.getAttribute('start'))
                : 1,
              tight: el.hasAttribute('data-tight'),
            }
          },
        },
      ],
      toDOM(node) {
        return [
          'ol',
          {
            start: node.attrs.order === 1 ? null : node.attrs.order,
            'data-tight': node.attrs.tight ? 'true' : null,
          },
          0,
        ]
      },
    }),

    bullet_list: blockWithSrc({
      content: 'list_item+',
      group: 'block',
      attrs: {
        tight: { default: true },
      },
      parseDOM: [
        {
          tag: 'ul',
          getAttrs(dom) {
            return {
              tight: (dom as HTMLElement).hasAttribute('data-tight'),
            }
          },
        },
      ],
      toDOM(node) {
        return [
          'ul',
          { 'data-tight': node.attrs.tight ? 'true' : null },
          0,
        ]
      },
    }),

    list_item: blockWithSrc({
      content: 'block+',
      defining: true,
      attrs: {
        /** `null` = normal item; `true` / `false` = GFM task item. */
        checked: { default: null as boolean | null },
      },
      parseDOM: [
        {
          tag: 'li',
          getAttrs(dom) {
            const el = dom as HTMLElement
            if (el.getAttribute('data-task') === 'true') {
              return {
                checked: el.getAttribute('data-checked') === 'true',
              }
            }
            return { checked: null }
          },
        },
      ],
      toDOM(node) {
        const checked = node.attrs.checked as boolean | null
        if (checked === null) {
          return ['li', 0]
        }
        return [
          'li',
          {
            'data-task': 'true',
            'data-checked': checked ? 'true' : 'false',
          },
          0,
        ]
      },
    }),

    table: blockWithSrc({
      content: 'table_row+',
      group: 'block',
      isolating: true,
      parseDOM: [{ tag: 'table' }],
      toDOM() {
        return ['table', ['tbody', 0]]
      },
    }),

    table_row: {
      content: '(table_header | table_cell)+',
      attrs: { ...SRC_RANGE_ATTRS },
      parseDOM: [{ tag: 'tr' }],
      toDOM() {
        return ['tr', 0]
      },
    },

    table_header: {
      content: 'inline*',
      attrs: {
        ...SRC_RANGE_ATTRS,
        align: { default: null as string | null },
      },
      parseDOM: [{ tag: 'th' }],
      toDOM(node) {
        const align = node.attrs.align as string | null
        return ['th', align ? { style: `text-align: ${align}` } : {}, 0]
      },
    },

    table_cell: {
      content: 'inline*',
      attrs: {
        ...SRC_RANGE_ATTRS,
        align: { default: null as string | null },
      },
      parseDOM: [{ tag: 'td' }],
      toDOM(node) {
        const align = node.attrs.align as string | null
        return ['td', align ? { style: `text-align: ${align}` } : {}, 0]
      },
    },

    front_matter: blockWithSrc({
      group: 'block',
      atom: true,
      attrs: {
        value: { default: '' },
      },
      parseDOM: [
        {
          tag: 'div[data-front-matter]',
          getAttrs(dom) {
            return {
              value: (dom as HTMLElement).getAttribute('data-value') ?? '',
            }
          },
        },
      ],
      toDOM(node) {
        return [
          'div',
          {
            'data-front-matter': 'true',
            'data-value': node.attrs.value as string,
          },
        ]
      },
    }),

    html_block: blockWithSrc({
      group: 'block',
      atom: true,
      attrs: {
        html: { default: '' },
      },
      parseDOM: [
        {
          tag: 'div[data-html-block]',
          getAttrs(dom) {
            return {
              html: (dom as HTMLElement).getAttribute('data-html') ?? '',
            }
          },
        },
      ],
      toDOM(node) {
        return [
          'div',
          {
            'data-html-block': 'true',
            'data-html': node.attrs.html as string,
          },
        ]
      },
    }),

    text: {
      group: 'inline',
    },

    image: {
      inline: true,
      group: 'inline',
      draggable: true,
      attrs: {
        src: { default: '' },
        alt: { default: null as string | null },
        title: { default: null as string | null },
      },
      parseDOM: [
        {
          tag: 'img[src]',
          getAttrs(dom) {
            const el = dom as HTMLElement
            return {
              src: el.getAttribute('src') ?? '',
              alt: el.getAttribute('alt'),
              title: el.getAttribute('title'),
            }
          },
        },
      ],
      toDOM(node) {
        return ['img', node.attrs]
      },
    },

    hard_break: {
      inline: true,
      group: 'inline',
      selectable: false,
      parseDOM: [{ tag: 'br' }],
      toDOM() {
        return ['br']
      },
    },
  },

  marks: {
    em: {
      parseDOM: [
        { tag: 'i' },
        { tag: 'em' },
        { style: 'font-style=italic' },
      ],
      toDOM() {
        return ['em']
      },
    } satisfies MarkSpec,

    strong: {
      parseDOM: [
        { tag: 'strong' },
        {
          tag: 'b',
          getAttrs: (node) =>
            (node as HTMLElement).style.fontWeight !== 'normal' && null,
        },
        {
          style: 'font-weight',
          getAttrs: (value) =>
            /^(bold(er)?|[5-9]\d{2,})$/.test(value as string) && null,
        },
      ],
      toDOM() {
        return ['strong']
      },
    } satisfies MarkSpec,

    code: {
      code: true,
      parseDOM: [{ tag: 'code' }],
      toDOM() {
        return ['code']
      },
    } satisfies MarkSpec,

    link: {
      attrs: {
        href: { default: '' },
        title: { default: null as string | null },
      },
      inclusive: false,
      parseDOM: [
        {
          tag: 'a[href]',
          getAttrs(dom) {
            const el = dom as HTMLElement
            return {
              href: el.getAttribute('href') ?? '',
              title: el.getAttribute('title'),
            }
          },
        },
      ],
      toDOM(node) {
        return ['a', node.attrs]
      },
    } satisfies MarkSpec,

    strikethrough: {
      parseDOM: [
        { tag: 's' },
        { tag: 'del' },
        { tag: 'strike' },
        { style: 'text-decoration=line-through' },
      ],
      toDOM() {
        return ['s']
      },
    } satisfies MarkSpec,
  },
})

export type MarkdownSchema = typeof markdownSchema
