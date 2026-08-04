import type { Node as PMNode } from 'prosemirror-model'
import { parseMarkdown } from './parse'
import { markdownSchema } from './schema'
import { mdastToProseMirror } from './toProseMirror'

export { parseMarkdown } from './parse'
export { SRC_RANGE_ATTRS, srcAttrsFromNode, srcRangeFromNode } from './positions'
export type { SrcRange } from './positions'
export { markdownSchema } from './schema'
export type { MarkdownSchema } from './schema'
export { mdastToProseMirror } from './toProseMirror'
export { alignDocs, alignMarkdown, extractBlocks } from './align'
export type { BlockView, RowModel } from './align'
export { wordDiff } from './wordDiff'
export type { DiffSegment } from './wordDiff'
export {
  buildViewSections,
  findUnchangedSectionForRow,
} from './viewSections'
export type {
  ChangedSection,
  UnchangedSection,
  ViewSection,
} from './viewSections'
export {
  linesForRange,
  mergeSourceRanges,
  offsetsToSourceRange,
  plainOffsetToPos,
} from './sourceRange'
export type {
  BlockSourceAnchor,
  ReviewSide,
  SourceRange,
} from './sourceRange'
export { docToMarkdown } from './toMarkdown'

/**
 * Parse Markdown source into a ProseMirror document.
 *
 * Positions on block nodes use 1-based inclusive line numbers (`srcFrom` / `srcTo`).
 */
export function markdownToDoc(source: string): PMNode {
  const tree = parseMarkdown(source)
  return mdastToProseMirror(tree)
}

/** Empty document that still matches `markdownSchema`. */
export function emptyDoc(): PMNode {
  return markdownSchema.node('doc', null, [
    markdownSchema.node('paragraph', { srcFrom: null, srcTo: null }),
  ])
}
