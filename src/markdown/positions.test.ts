import { describe, expect, it } from 'vitest'
import { srcAttrsFromNode, srcRangeFromNode } from './positions'

describe('srcRangeFromNode', () => {
  it('reads 1-based inclusive lines from a unist position', () => {
    expect(
      srcRangeFromNode({
        type: 'paragraph',
        position: {
          start: { line: 2, column: 1, offset: 3 },
          end: { line: 4, column: 5, offset: 20 },
        },
      }),
    ).toEqual({ from: 2, to: 4 })
  })

  it('returns null when position is missing', () => {
    expect(srcRangeFromNode({ type: 'paragraph' })).toBeNull()
    expect(srcAttrsFromNode({ type: 'paragraph' })).toEqual({
      srcFrom: null,
      srcTo: null,
    })
  })
})
