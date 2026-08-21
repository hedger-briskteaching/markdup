import type { Node as PMNode } from "prosemirror-model";
import { parseMarkdown } from "./parse";
import { markdownSchema } from "./schema";
import { mdastToProseMirror } from "./toProseMirror";

export { parseMarkdown } from "./parse";
export { SRC_RANGE_ATTRS, srcAttrsFromNode, srcRangeFromNode } from "./positions";
export type { SrcRange } from "./positions";
export { markdownSchema } from "./schema";
export type { MarkdownSchema } from "./schema";
export { mdastToProseMirror } from "./toProseMirror";
export { alignDocs, alignMarkdown, extractBlocks } from "./align";
export type { BlockView, RowModel } from "./align";
export { wordDiff } from "./wordDiff";
export type { DiffSegment } from "./wordDiff";
export { buildViewSections, findUnchangedSectionForRow } from "./viewSections";
export type { ChangedSection, UnchangedSection, ViewSection } from "./viewSections";
export {
  linesForRange,
  mergeSourceRanges,
  offsetsToSourceRange,
  plainOffsetToPos,
} from "./sourceRange";
export type { BlockSourceAnchor, ReviewSide, SourceRange } from "./sourceRange";
export { docToMarkdown } from "./toMarkdown";

/**
 * Parse a Markdown string into a ProseMirror document.
 * Block nodes carry 1-based inclusive line numbers (`srcFrom` / `srcTo`).
 * @param source - Raw Markdown text.
 * @returns The ProseMirror document node.
 */
export function markdownToDoc(source: string): PMNode {
  const tree = parseMarkdown(source);
  return mdastToProseMirror(tree);
}

/**
 * Create an empty document that is valid against `markdownSchema`.
 * @returns A doc node with a single empty paragraph.
 */
export function emptyDoc(): PMNode {
  return markdownSchema.node("doc", null, [
    markdownSchema.node("paragraph", { srcFrom: null, srcTo: null }),
  ]);
}
