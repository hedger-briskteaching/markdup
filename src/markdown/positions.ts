import type { Node as UnistNode } from 'unist'

/** 1-based inclusive source line range from an mdast/unist position. */
export type SrcRange = {
  from: number
  to: number
}

export const SRC_RANGE_ATTRS = {
  srcFrom: { default: null as number | null },
  srcTo: { default: null as number | null },
} as const

export function srcRangeFromNode(node: UnistNode): SrcRange | null {
  const start = node.position?.start?.line
  const end = node.position?.end?.line
  if (typeof start !== 'number' || typeof end !== 'number') {
    return null
  }
  return { from: start, to: end }
}

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
