import type { RowModel } from './align'

export type ChangedSection = {
  kind: 'changed'
  rows: RowModel[]
}

export type UnchangedSection = {
  kind: 'unchanged'
  id: string
  rows: RowModel[]
  /** Inclusive source line span across both sides when known. */
  lineFrom: number | null
  lineTo: number | null
}

export type ViewSection = ChangedSection | UnchangedSection

/**
 * Group consecutive RowModel runs into changed vs unchanged sections.
 * Unchanged sections get stable ids for expand/collapse UI state.
 */
export function buildViewSections(rows: RowModel[]): ViewSection[] {
  if (rows.length === 0) return []

  const sections: ViewSection[] = []
  let i = 0
  let unchangedIndex = 0

  while (i < rows.length) {
    const start = i
    const changed = rows[i]!.changed
    i += 1
    while (i < rows.length && rows[i]!.changed === changed) {
      i += 1
    }
    const slice = rows.slice(start, i)
    if (changed) {
      sections.push({ kind: 'changed', rows: slice })
    } else {
      const id = `unchanged-${unchangedIndex}`
      unchangedIndex += 1
      sections.push({
        kind: 'unchanged',
        id,
        rows: slice,
        ...lineSpanForRows(slice),
      })
    }
  }

  return sections
}

/** Find the unchanged section that owns a row id, if any. */
export function findUnchangedSectionForRow(
  sections: ViewSection[],
  rowId: string,
): UnchangedSection | null {
  for (const section of sections) {
    if (section.kind !== 'unchanged') continue
    if (section.rows.some((row) => row.id === rowId)) {
      return section
    }
  }
  return null
}

function lineSpanForRows(rows: RowModel[]): {
  lineFrom: number | null
  lineTo: number | null
} {
  let lineFrom: number | null = null
  let lineTo: number | null = null

  for (const row of rows) {
    for (const block of [row.old, row.new]) {
      if (!block) continue
      if (block.srcFrom != null) {
        lineFrom =
          lineFrom == null ? block.srcFrom : Math.min(lineFrom, block.srcFrom)
      }
      if (block.srcTo != null) {
        lineTo = lineTo == null ? block.srcTo : Math.max(lineTo, block.srcTo)
      }
    }
  }

  return { lineFrom, lineTo }
}
