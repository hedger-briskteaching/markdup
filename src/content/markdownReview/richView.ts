import { DOMSerializer, type Node as PMNode } from 'prosemirror-model'
import type { BlockView, RowModel } from '../../markdown/align'
import { markdownSchema } from '../../markdown/schema'
import { wordDiff, type DiffSegment } from '../../markdown/wordDiff'
import { DIFF_BODY, RGM_STUB } from './selectors'

const HIDDEN_ATTR = 'data-rgm-diff-hidden'
const serializer = DOMSerializer.fromSchema(markdownSchema)

const TEXT_DIFF_TYPES = new Set([
  'paragraph',
  'heading',
  'list_item',
  'blockquote',
])

function findDiffBody(region: Element): HTMLElement | null {
  const header = region.querySelector('[data-diff-header-wrapper]')
  if (header?.parentElement === region) {
    let sibling = header.nextElementSibling
    while (sibling) {
      if (
        sibling instanceof HTMLElement &&
        sibling.querySelector('table[aria-label^="Diff for:"]')
      ) {
        return sibling
      }
      sibling = sibling.nextElementSibling
    }
  }

  return region.querySelector<HTMLElement>(DIFF_BODY)
}

/**
 * Hide the native source diff and show the rich Before/After view.
 */
export function showRichView(region: Element, rows: RowModel[]): void {
  const diffBody = findDiffBody(region)
  if (!diffBody) {
    return
  }

  diffBody.setAttribute(HIDDEN_ATTR, '')
  region.querySelector('[data-rgm-auth-panel]')?.remove()

  let root = region.querySelector<HTMLElement>('[data-rgm-rich]')
  if (!root) {
    root = document.createElement('div')
    root.setAttribute('data-rgm-rich', '')
    root.setAttribute('data-rgm-stub', '')
    diffBody.after(root)
  }

  root.replaceChildren(buildRichRoot(rows))
}

export function showRichLoading(region: Element): void {
  const diffBody = findDiffBody(region)
  if (!diffBody) {
    return
  }
  diffBody.setAttribute(HIDDEN_ATTR, '')
  region.querySelector('[data-rgm-auth-panel]')?.remove()

  let root = region.querySelector<HTMLElement>('[data-rgm-rich]')
  if (!root) {
    root = document.createElement('div')
    root.setAttribute('data-rgm-rich', '')
    root.setAttribute('data-rgm-stub', '')
    diffBody.after(root)
  }

  root.replaceChildren()
  const status = document.createElement('p')
  status.className = 'rgm-rich-status'
  status.textContent = 'Loading rich Markdown view…'
  root.appendChild(status)
}

export function showRichError(region: Element, message: string): void {
  const diffBody = findDiffBody(region)
  if (!diffBody) {
    return
  }
  diffBody.setAttribute(HIDDEN_ATTR, '')

  let root = region.querySelector<HTMLElement>('[data-rgm-rich]')
  if (!root) {
    root = document.createElement('div')
    root.setAttribute('data-rgm-rich', '')
    root.setAttribute('data-rgm-stub', '')
    diffBody.after(root)
  }

  root.replaceChildren()
  const status = document.createElement('p')
  status.className = 'rgm-rich-status rgm-rich-status-error'
  status.textContent = message
  root.appendChild(status)
}

export function hideRichView(region: Element): void {
  const diffBody = findDiffBody(region)
  diffBody?.removeAttribute(HIDDEN_ATTR)
  region.querySelector('[data-rgm-rich]')?.remove()
  region.querySelector(RGM_STUB)?.remove()
}

export function isRichMode(region: Element): boolean {
  return region.getAttribute('data-rgm-mode') === 'rich'
}

function buildRichRoot(rows: RowModel[]): DocumentFragment {
  const frag = document.createDocumentFragment()

  const header = document.createElement('div')
  header.className = 'rgm-rich-header'
  header.innerHTML =
    '<div class="rgm-rich-header-side" aria-label="Before">Before</div>' +
    '<div class="rgm-rich-header-side" aria-label="After">After</div>'
  frag.appendChild(header)

  const body = document.createElement('div')
  body.className = 'rgm-rich-body'
  body.setAttribute('role', 'table')
  body.setAttribute('aria-label', 'Rich markdown diff')

  for (const row of rows) {
    body.appendChild(buildRow(row))
  }

  frag.appendChild(body)
  return frag
}

function buildRow(row: RowModel): HTMLElement {
  const el = document.createElement('div')
  el.className = 'rgm-rich-row'
  el.setAttribute('data-row-id', row.id)
  el.setAttribute('data-changed', row.changed ? 'true' : 'false')
  el.setAttribute('role', 'row')

  el.appendChild(
    buildCell({
      side: 'before',
      block: row.old,
      peer: row.new,
      changed: row.changed,
      rowId: row.id,
    }),
  )
  el.appendChild(
    buildCell({
      side: 'after',
      block: row.new,
      peer: row.old,
      changed: row.changed,
      rowId: row.id,
    }),
  )

  return el
}

function buildCell(args: {
  side: 'before' | 'after'
  block?: BlockView
  peer?: BlockView
  changed: boolean
  rowId: string
}): HTMLElement {
  const { side, block, peer, changed, rowId } = args
  const cell = document.createElement('div')
  cell.className = `rgm-rich-cell rgm-rich-cell-${side}`
  cell.setAttribute('role', 'cell')
  cell.setAttribute('data-block-id', `${rowId}::${side}`)

  if (changed && block) {
    cell.classList.add(
      side === 'before' ? 'rgm-rich-cell-del' : 'rgm-rich-cell-add',
    )
  }

  if (!block) {
    cell.classList.add('rgm-rich-cell-missing')
    const missing = document.createElement('p')
    missing.className = 'rgm-rich-missing'
    missing.textContent = 'not present'
    cell.appendChild(missing)
    return cell
  }

  cell.appendChild(buildGutter(block))
  cell.appendChild(buildBlockContent(block, side, peer, changed))
  return cell
}

function buildGutter(block: BlockView): HTMLElement {
  const gutter = document.createElement('div')
  gutter.className = 'rgm-rich-gutter'
  gutter.setAttribute('aria-hidden', 'true')

  const from = document.createElement('span')
  from.className = 'rgm-rich-gutter-line'
  from.textContent =
    block.srcFrom != null ? String(block.srcFrom) : ''

  const rule = document.createElement('span')
  rule.className = 'rgm-rich-gutter-rule'

  const to = document.createElement('span')
  to.className = 'rgm-rich-gutter-line'
  const showTo =
    block.srcTo != null &&
    block.srcFrom != null &&
    block.srcTo !== block.srcFrom
  to.textContent = showTo ? String(block.srcTo) : ''

  gutter.appendChild(from)
  gutter.appendChild(rule)
  gutter.appendChild(to)
  return gutter
}

function buildBlockContent(
  block: BlockView,
  side: 'before' | 'after',
  peer: BlockView | undefined,
  changed: boolean,
): HTMLElement {
  const wrap = document.createElement('div')
  wrap.className = 'rgm-rich-content'

  if (block.type === 'front_matter') {
    wrap.appendChild(renderFrontMatter(block))
    return wrap
  }

  if (
    changed &&
    peer &&
    TEXT_DIFF_TYPES.has(block.type) &&
    block.type === peer.type
  ) {
    const oldText =
      side === 'before' ? block.node.textContent : peer.node.textContent
    const newText =
      side === 'before' ? peer.node.textContent : block.node.textContent
    const { oldSegments, newSegments } = wordDiff(oldText, newText)
    const segments = side === 'before' ? oldSegments : newSegments
    if (segments.some((s) => s.tone)) {
      wrap.appendChild(renderSegmentedBlock(block, segments, side))
      return wrap
    }
  }

  const dom = serializer.serializeNode(block.node)
  if (dom instanceof HTMLElement) {
    enhanceSerialized(dom, block)
    wrap.appendChild(dom)
  } else {
    wrap.appendChild(dom)
  }
  return wrap
}

function renderSegmentedBlock(
  block: BlockView,
  segments: DiffSegment[],
  side: 'before' | 'after',
): HTMLElement {
  const tag =
    block.type === 'heading'
      ? `h${(block.node.attrs.level as number) || 1}`
      : 'p'
  const el = document.createElement(tag)
  el.className = `rgm-rich-block rgm-rich-block-${block.type}`

  if (block.type === 'list_item') {
    const item = document.createElement('div')
    item.className = 'rgm-rich-list-item'
    const bullet = document.createElement('span')
    bullet.className = 'rgm-rich-bullet'
    bullet.textContent = '•'
    item.appendChild(bullet)
    const text = document.createElement('span')
    appendSegments(text, segments, side)
    item.appendChild(text)
    return item
  }

  appendSegments(el, segments, side)
  return el
}

function appendSegments(
  parent: HTMLElement,
  segments: DiffSegment[],
  side: 'before' | 'after',
): void {
  for (const seg of segments) {
    if (!seg.tone) {
      parent.appendChild(document.createTextNode(seg.text))
      continue
    }
    if (side === 'before' && seg.tone === 'ins') continue
    if (side === 'after' && seg.tone === 'del') continue

    const mark = document.createElement('span')
    mark.className =
      seg.tone === 'ins' ? 'rgm-rich-ins' : 'rgm-rich-del'
    mark.textContent = seg.text
    parent.appendChild(mark)
  }
}

function renderFrontMatter(block: BlockView): HTMLElement {
  const card = document.createElement('div')
  card.className = 'rgm-rich-front-matter'
  const label = document.createElement('div')
  label.className = 'rgm-rich-front-matter-label'
  label.textContent = 'Front matter'
  card.appendChild(label)

  const pre = document.createElement('pre')
  pre.className = 'rgm-rich-front-matter-body'
  pre.textContent = String(block.node.attrs.value ?? '')
  card.appendChild(pre)
  return card
}

function enhanceSerialized(dom: HTMLElement, block: BlockView): void {
  if (block.type === 'code_block') {
    const lang = String(block.node.attrs.params ?? '')
    if (lang) {
      dom.setAttribute('data-lang', lang)
      const chip = document.createElement('span')
      chip.className = 'rgm-rich-code-lang'
      chip.textContent = lang
      dom.prepend(chip)
    }
  }
}

/** @internal Test helper — render rows to an isolated element. */
export function renderRowsForTest(rows: RowModel[]): HTMLElement {
  const host = document.createElement('div')
  host.appendChild(buildRichRoot(rows))
  return host
}

/** @internal Expose node text for tests. */
export function blockTextForTest(node: PMNode): string {
  return node.textContent
}
