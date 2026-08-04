import { describe, expect, it } from 'vitest'
import { alignMarkdown, type RowModel } from './align'
import {
  buildViewSections,
  findUnchangedSectionForRow,
} from './viewSections'

describe('buildViewSections', () => {
  it('returns empty for empty rows', () => {
    expect(buildViewSections([])).toEqual([])
  })

  it('groups an all-equal document into one unchanged section', () => {
    const rows = alignMarkdown('# A\n\npara\n', '# A\n\npara\n')
    expect(rows.every((r) => !r.changed)).toBe(true)
    const sections = buildViewSections(rows)
    expect(sections).toHaveLength(1)
    expect(sections[0]).toMatchObject({
      kind: 'unchanged',
      id: 'unchanged-0',
    })
    if (sections[0]?.kind === 'unchanged') {
      expect(sections[0].rows).toHaveLength(rows.length)
      expect(sections[0].lineFrom).toBe(1)
    }
  })

  it('interleaves changed and unchanged runs', () => {
    const rows = alignMarkdown(
      '# Same\n\nOld para\n\n# Tail\n',
      '# Same\n\nNew para\n\n# Tail\n',
    )
    const sections = buildViewSections(rows)
    expect(sections.map((s) => s.kind)).toEqual([
      'unchanged',
      'changed',
      'unchanged',
    ])
    expect(sections[0]).toMatchObject({ kind: 'unchanged', id: 'unchanged-0' })
    expect(sections[1]).toMatchObject({ kind: 'changed' })
    expect(sections[2]).toMatchObject({ kind: 'unchanged', id: 'unchanged-1' })
  })

  it('emits only changed when every row differs', () => {
    const rows = alignMarkdown('A\n', 'B\n')
    expect(rows.every((r) => r.changed)).toBe(true)
    const sections = buildViewSections(rows)
    expect(sections).toHaveLength(1)
    expect(sections[0]?.kind).toBe('changed')
  })

  it('finds the unchanged section that owns a row', () => {
    const rows = alignMarkdown(
      '# Same\n\nOld\n\n# Tail\n',
      '# Same\n\nNew\n\n# Tail\n',
    )
    const sections = buildViewSections(rows)
    const firstEqual = rows.find((r) => !r.changed)!
    const changed = rows.find((r) => r.changed)!
    expect(findUnchangedSectionForRow(sections, firstEqual.id)?.id).toBe(
      'unchanged-0',
    )
    expect(findUnchangedSectionForRow(sections, changed.id)).toBeNull()
  })
})

describe('buildViewSections line spans', () => {
  it('derives line spans from block src ranges', () => {
    const rows: RowModel[] = [
      {
        id: 'row-0',
        changed: false,
        old: {
          type: 'heading',
          srcFrom: 1,
          srcTo: 1,
          node: null as never,
          normText: 'a',
        },
        new: {
          type: 'heading',
          srcFrom: 1,
          srcTo: 1,
          node: null as never,
          normText: 'a',
        },
      },
      {
        id: 'row-1',
        changed: false,
        old: {
          type: 'paragraph',
          srcFrom: 3,
          srcTo: 4,
          node: null as never,
          normText: 'b',
        },
        new: {
          type: 'paragraph',
          srcFrom: 3,
          srcTo: 4,
          node: null as never,
          normText: 'b',
        },
      },
    ]
    const sections = buildViewSections(rows)
    expect(sections[0]).toMatchObject({
      kind: 'unchanged',
      lineFrom: 1,
      lineTo: 4,
    })
  })
})
