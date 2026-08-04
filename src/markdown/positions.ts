import type { Node as UnistNode } from 'unist'

/** A 1-based inclusive source line range derived from an mdast/unist position. */
export type SrcRange = {
  from: number
  to: number
}

/** Default ProseMirror attribute definitions for source-range tracking. */
export const SRC_RANGE_ATTRS = {
  srcFrom: { default: null as number | null },
  srcTo: { default: null as number | null },
} as const

/**
 * Extract the source line range from a unist node's position.
 * @param node - Any unist/mdast node.
 * @returns The 1-based inclusive line range, or `null` when position data is absent.
 */
export function srcRangeFromNode(node: UnistNode): SrcRange | null {
  const start = node.position?.start?.line
  const end = node.position?.end?.line
  if (typeof start !== 'number' || typeof end !== 'number') {
    return null
  }
  return { from: start, to: end }
}

/**
 * Build ProseMirror `srcFrom` / `srcTo` attributes from a unist node.
 * @param node - Any unist/mdast node.
 * @returns An object with `srcFrom` and `srcTo` (both `null` when position data is absent).
 */
export function srcAttrsFromNode(node: UnistNode): {
  srcFrom: number | null
  srcTo: number | null
} {
  const range = srcRangeFromNode(node)
  return {
    srcFrom: range?.from ?? null,
    srcTo: range?.to ?? null,
  }
}
