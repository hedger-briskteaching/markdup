import { describe, expect, it } from 'vitest'
import { alignMarkdown } from '../../markdown/align'
import type { ReviewThreadDto } from '../../shared/messages'
import { renderRowsForTest } from './richView'
import { setRichViewContext } from './selection'
import {
  findRowIdForThread,
  isReanchored,
  renderThreadCards,
  upsertThreadFromComment,
} from './threads'

function thread(
  partial: Partial<ReviewThreadDto> &
    Pick<ReviewThreadDto, 'rootId' | 'side' | 'startLine' | 'line'>,
  commentExtras: { originalLine?: number | null; body?: string } = {},
): ReviewThreadDto {
  return {
    path: 'docs/PLAN.md',
    comments: [
      {
        id: partial.rootId,
        body: commentExtras.body ?? 'Please expand this.',
        path: 'docs/PLAN.md',
        side: partial.side,
        line: partial.line,
        startLine: partial.startLine,
        originalLine: commentExtras.originalLine ?? null,
        inReplyToId: null,
        userLogin: 'jgable',
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        commitId: 'abc',
        htmlUrl: 'https://github.com/o/r/pull/1#discussion_r1',
        pullRequestReviewId: null,
      },
    ],
    pending: false,
    ...partial,
  }
}

describe('findRowIdForThread', () => {
  it('matches a RIGHT thread to the After block by line', () => {
    const rows = alignMarkdown('# A\n\nHello.\n', '# A\n\nHello world.\n')
    const id = findRowIdForThread(
      rows,
      thread({ rootId: 1, side: 'RIGHT', startLine: 3, line: 3 }),
    )
    expect(id).toBeTruthy()
    const row = rows.find((r) => r.id === id)
    expect(row?.new?.srcFrom).toBe(3)
  })

  it('matches a LEFT thread to the Before block', () => {
    const rows = alignMarkdown('Old only.\n', 'New only.\n')
    const id = findRowIdForThread(
      rows,
      thread({ rootId: 2, side: 'LEFT', startLine: 1, line: 1 }),
    )
    expect(id).toBeTruthy()
  })
})

describe('isReanchored', () => {
  it('detects when originalLine differs from current line', () => {
    expect(
      isReanchored(
        thread(
          { rootId: 1, side: 'RIGHT', startLine: 1223, line: 1223 },
          { originalLine: 1222 },
        ),
      ),
    ).toBe(true)
  })

  it('is false when original matches current', () => {
    expect(
      isReanchored(
        thread(
          { rootId: 1, side: 'RIGHT', startLine: 3, line: 3 },
          { originalLine: 3 },
        ),
      ),
    ).toBe(false)
  })
})

/**
 * Table on lines 3-7. The delimiter is line 4, so the body rows are on
 * lines 5, 6, and 7.
 */
const TABLE_MD = [
  '# When cleanup runs',
  '',
  '| Trigger | Client steps | API |',
  '| --- | --- | --- |',
  '| Modal close | abort in-flight upload | cleanup all ids |',
  '| Remove one row | drop row from UI | subset of ids |',
  '| Abort mid-flight | dequeue and abort | ids already known |',
  '',
].join('\n')

/** Render the table with one RIGHT thread on the given lines, cards drawn. */
function tableThreadHost(lines: {
  startLine: number
  line: number
}): HTMLElement {
  const rows = alignMarkdown(TABLE_MD, TABLE_MD)
  const host = renderRowsForTest(rows, {
    baseText: TABLE_MD,
    headText: TABLE_MD,
    path: 'docs/PLAN.md',
  })
  setRichViewContext(host, {
    baseText: TABLE_MD,
    headText: TABLE_MD,
    rows,
    path: 'docs/PLAN.md',
    threads: [thread({ rootId: 9, side: 'RIGHT', ...lines })],
  })
  renderThreadCards(host)
  return host
}

/** Bullet list on lines 3-5, one item per line. */
const LIST_MD = [
  '# Plan',
  '',
  '- item 1',
  '- item 2',
  '- item 3',
  '',
].join('\n')

/**
 * Nested list. Outer items on lines 3 and 6, nested items on lines 4 and 5.
 */
const NESTED_LIST_MD = [
  '# Plan',
  '',
  '- item 1',
  '  - sub a',
  '  - sub b',
  '- item 2',
  '',
].join('\n')

/** Render a list with one RIGHT thread on the given lines, cards drawn. */
function listThreadHost(
  lines: { startLine: number; line: number },
  markdown: string = LIST_MD,
): HTMLElement {
  const rows = alignMarkdown(markdown, markdown)
  const host = renderRowsForTest(rows, {
    baseText: markdown,
    headText: markdown,
    path: 'docs/PLAN.md',
  })
  setRichViewContext(host, {
    baseText: markdown,
    headText: markdown,
    rows,
    path: 'docs/PLAN.md',
    threads: [thread({ rootId: 9, side: 'RIGHT', ...lines })],
  })
  renderThreadCards(host)
  return host
}

/** The list items and comment slots of the After cell, in document order. */
function listChildren(host: HTMLElement): Element[] {
  return [
    ...host.querySelectorAll('.rgm-rich-cell[data-side="RIGHT"] ul > *'),
  ]
}

describe('renderThreadCards', () => {
  it('renders an Open chip under the matching row', () => {
    const baseText = '# Title\n\nBody here.\n'
    const headText = '# Title\n\nBody here.\n'
    const rows = alignMarkdown(baseText, headText)
    const host = renderRowsForTest(rows, {
      baseText,
      headText,
      path: 'docs/PLAN.md',
    })
    setRichViewContext(host, {
      baseText,
      headText,
      rows,
      path: 'docs/PLAN.md',
      threads: [thread({ rootId: 9, side: 'RIGHT', startLine: 3, line: 3 })],
    })

    renderThreadCards(host)

    const card = host.querySelector(
      '.rgm-rich-cell[data-side="RIGHT"] [data-rgm-thread-card]',
    )
    expect(card).not.toBeNull()
    expect(card?.textContent).toContain('jgable')
    expect(card?.textContent).toContain('Open')
    expect(card?.textContent).toContain('PLAN.md L3')
  })

  it('mounts a table thread in its own row under the row it targets', () => {
    const host = tableThreadHost({ startLine: 6, line: 6 })

    const rows = [
      ...host.querySelectorAll('.rgm-rich-cell[data-side="RIGHT"] tr'),
    ]
    const cardRow = host.querySelector(
      '.rgm-rich-cell[data-side="RIGHT"] .rgm-rich-comment-row',
    )
    expect(cardRow).not.toBeNull()
    expect(cardRow?.querySelector('[data-rgm-thread-card]')).not.toBeNull()

    // Directly after the row on line 6, and before the row on line 7.
    const index = rows.indexOf(cardRow as Element)
    expect(rows[index - 1]?.getAttribute('data-src-from')).toBe('6')
    expect(rows[index + 1]?.getAttribute('data-src-from')).toBe('7')
  })

  it('spans the comment row across every table column', () => {
    const host = tableThreadHost({ startLine: 6, line: 6 })
    const holder = host.querySelector<HTMLTableCellElement>(
      '.rgm-rich-comment-row > td',
    )
    expect(holder?.colSpan).toBe(3)
  })

  it('marks the comment row as chrome so it stays out of source text', () => {
    const host = tableThreadHost({ startLine: 6, line: 6 })
    const cardRow = host.querySelector('.rgm-rich-comment-row')
    expect(cardRow?.hasAttribute('data-rgm-chrome')).toBe(true)
  })

  it('mounts under the last row a multi-row thread covers', () => {
    const host = tableThreadHost({ startLine: 5, line: 6 })
    const rows = [
      ...host.querySelectorAll('.rgm-rich-cell[data-side="RIGHT"] tr'),
    ]
    const cardRow = host.querySelector('.rgm-rich-comment-row')
    const index = rows.indexOf(cardRow as Element)
    expect(rows[index - 1]?.getAttribute('data-src-from')).toBe('6')
  })

  it('leaves no empty comment rows behind on a re-render', () => {
    const host = tableThreadHost({ startLine: 6, line: 6 })
    renderThreadCards(host)
    renderThreadCards(host)

    expect(host.querySelectorAll('.rgm-rich-comment-row')).toHaveLength(1)
    expect(host.querySelectorAll('[data-rgm-thread-card]')).toHaveLength(1)
  })

  it('mounts a list thread in its own item under the item it targets', () => {
    const host = listThreadHost({ startLine: 3, line: 3 })

    const slot = host.querySelector('.rgm-rich-comment-item')
    expect(slot).not.toBeNull()
    expect(slot?.querySelector('[data-rgm-thread-card]')).not.toBeNull()

    // Directly after the item on line 3, and before the item on line 4.
    const children = listChildren(host)
    const index = children.indexOf(slot as Element)
    expect(children[index - 1]?.getAttribute('data-src-from')).toBe('3')
    expect(children[index + 1]?.getAttribute('data-src-from')).toBe('4')
  })

  it('marks the comment item as chrome so it stays out of source text', () => {
    const host = listThreadHost({ startLine: 3, line: 3 })
    const slot = host.querySelector('.rgm-rich-comment-item')
    expect(slot?.hasAttribute('data-rgm-chrome')).toBe(true)
  })

  it('mounts under the last item a multi-item thread covers', () => {
    const host = listThreadHost({ startLine: 3, line: 4 })
    const children = listChildren(host)
    const slot = host.querySelector('.rgm-rich-comment-item')
    const index = children.indexOf(slot as Element)
    expect(children[index - 1]?.getAttribute('data-src-from')).toBe('4')
  })

  it('mounts inside the nested list for a thread on a nested item', () => {
    const host = listThreadHost({ startLine: 4, line: 4 }, NESTED_LIST_MD)
    const slot = host.querySelector('.rgm-rich-comment-item')
    const nested = [
      ...host.querySelectorAll(
        '.rgm-rich-cell[data-side="RIGHT"] ul ul > *',
      ),
    ]
    const index = nested.indexOf(slot as Element)
    expect(index).toBeGreaterThan(-1)
    expect(nested[index - 1]?.getAttribute('data-src-from')).toBe('4')
    expect(nested[index + 1]?.getAttribute('data-src-from')).toBe('5')
  })

  it('leaves no empty comment items behind on a re-render', () => {
    const host = listThreadHost({ startLine: 3, line: 3 })
    renderThreadCards(host)
    renderThreadCards(host)

    expect(host.querySelectorAll('.rgm-rich-comment-item')).toHaveLength(1)
    expect(host.querySelectorAll('[data-rgm-thread-card]')).toHaveLength(1)
  })

  it('keeps cards at the end of the cell for blocks without rows', () => {
    const baseText = '# Title\n\nBody here.\n'
    const rows = alignMarkdown(baseText, baseText)
    const host = renderRowsForTest(rows, {
      baseText,
      headText: baseText,
      path: 'docs/PLAN.md',
    })
    setRichViewContext(host, {
      baseText,
      headText: baseText,
      rows,
      path: 'docs/PLAN.md',
      threads: [thread({ rootId: 9, side: 'RIGHT', startLine: 3, line: 3 })],
    })

    renderThreadCards(host)

    expect(host.querySelector('.rgm-rich-comment-row')).toBeNull()
    const card = host.querySelector('[data-rgm-thread-card]')
    expect(card?.parentElement?.classList.contains('rgm-rich-cell')).toBe(true)
    expect(card?.parentElement?.lastElementChild).toBe(card)
  })

  it('renders a Re-anchored chip with old → new lines', () => {
    const baseText = 'Line one.\n'
    const headText = 'Line one.\n'
    const rows = alignMarkdown(baseText, headText)
    const host = renderRowsForTest(rows, {
      baseText,
      headText,
      path: 'docs/PLAN.md',
    })
    const moved = thread(
      { rootId: 4, side: 'RIGHT', startLine: 1, line: 1 },
      { originalLine: 1222 },
    )

    setRichViewContext(host, {
      baseText,
      headText,
      rows,
      path: 'docs/PLAN.md',
      threads: [moved],
    })
    renderThreadCards(host)

    const card = host.querySelector('[data-rgm-thread-card]')
    expect(card?.textContent).toContain('Re-anchored — source moved')
    expect(card?.textContent).toContain('L1222 → L1')
  })

  it('expands comment body when Show is clicked', () => {
    const text = 'Hello.\n'
    const rows = alignMarkdown(text, text)
    const host = renderRowsForTest(rows, { baseText: text, headText: text })
    setRichViewContext(host, {
      baseText: text,
      headText: text,
      rows,
      path: 'README.md',
      threads: [thread({ rootId: 5, side: 'RIGHT', startLine: 1, line: 1 })],
    })
    renderThreadCards(host)

    const detail = host.querySelector<HTMLElement>('.rgm-thread-detail')
    // Cards start expanded so existing comments are visible.
    expect(detail?.hidden).toBe(false)
    expect(detail?.textContent).toContain('Please expand this.')
    host.querySelector<HTMLButtonElement>('.rgm-thread-show')!.click()
    expect(detail?.hidden).toBe(true)
  })

  it('renders a Pending chip for unsubmitted review threads', () => {
    const text = 'Hello world.\n'
    const rows = alignMarkdown(text, text)
    const host = renderRowsForTest(rows, { baseText: text, headText: text })
    document.body.appendChild(host)
    setRichViewContext(host, {
      baseText: text,
      headText: text,
      rows,
      path: 'README.md',
      threads: [
        thread(
          {
            rootId: 5,
            side: 'RIGHT',
            startLine: 1,
            line: 1,
            pending: true,
          },
          { body: 'Still drafting' },
        ),
      ],
    })

    renderThreadCards(host)
    const card = host.querySelector('[data-rgm-thread-card]')
    expect(card?.textContent).toContain('Pending')
    expect(card?.textContent).toContain('Still drafting')
  })

  it('renders every comment in the thread as Markdown', () => {
    const text = 'Hello.\n'
    const rows = alignMarkdown(text, text)
    const host = renderRowsForTest(rows, {
      baseText: text,
      headText: text,
      path: 'README.md',
      viewerLogin: 'hedger',
    })
    setRichViewContext(host, {
      baseText: text,
      headText: text,
      rows,
      path: 'README.md',
      viewerLogin: 'hedger',
      threads: [
        {
          rootId: 1,
          path: 'README.md',
          side: 'RIGHT',
          startLine: 1,
          line: 1,
          pending: false,
          comments: [
            {
              id: 1,
              body: 'Root **bold**',
              path: 'README.md',
              side: 'RIGHT',
              line: 1,
              startLine: 1,
              originalLine: null,
              inReplyToId: null,
              userLogin: 'alice',
              createdAt: '2026-01-01T00:00:00Z',
              commitId: 'sha',
              htmlUrl: 'https://example.com',
              pullRequestReviewId: null,
            },
            {
              id: 2,
              body: 'Reply `code`',
              path: 'README.md',
              side: 'RIGHT',
              line: 1,
              startLine: 1,
              originalLine: null,
              inReplyToId: 1,
              userLogin: 'hedger',
              createdAt: '2026-01-02T00:00:00Z',
              commitId: 'sha',
              htmlUrl: 'https://example.com',
              pullRequestReviewId: null,
            },
          ],
        },
      ],
    })
    renderThreadCards(host)

    expect(host.textContent).toContain('bold')
    expect(host.textContent).toContain('code')
    expect(host.textContent).not.toContain('more reply')
    expect(host.querySelectorAll('.rgm-thread-comment')).toHaveLength(2)
    expect(host.textContent).toContain('Reply')
    // Own comment gets Edit/Delete; alice's does not.
    const actions = [...host.querySelectorAll('.rgm-thread-comment')].map(
      (el) => el.textContent,
    )
    expect(actions.some((t) => t?.includes('Edit') && t.includes('Delete'))).toBe(
      true,
    )
  })

  it('upserts a new pending thread from a created comment', () => {
    const next = upsertThreadFromComment(
      [],
      {
        id: 42,
        body: 'Fresh',
        path: 'README.md',
        side: 'RIGHT',
        line: 3,
        startLine: 2,
        originalLine: null,
        inReplyToId: null,
        userLogin: 'bob',
        createdAt: '2026-01-01T00:00:00Z',
        commitId: 'sha',
        htmlUrl: 'https://example.com',
        pullRequestReviewId: 7,
      },
      { pending: true },
    )
    expect(next).toHaveLength(1)
    expect(next[0]).toMatchObject({
      rootId: 42,
      side: 'RIGHT',
      startLine: 2,
      line: 3,
      pending: true,
    })
  })
})
