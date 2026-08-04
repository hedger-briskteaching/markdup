import { describe, expect, it } from 'vitest'
import {
  linesForRange,
  mergeSourceRanges,
  offsetsToSourceRange,
  plainOffsetToPos,
  type SourceRange,
} from './sourceRange'

describe('linesForRange', () => {
  it('slices 1-based inclusive lines', () => {
    const text = 'a\nb\nc\n'
    expect(linesForRange(text, 1, 1)).toEqual(['a'])
    expect(linesForRange(text, 2, 3)).toEqual(['b', 'c'])
  })
})

describe('plainOffsetToPos', () => {
  it('maps offsets inside a single source line via plain-text locate', () => {
    const sourceLines = ['# Hello world']
    const plainText = 'Hello world'
    expect(
      plainOffsetToPos({
        plainText,
        srcFrom: 3,
        srcTo: 3,
        sourceLines,
        offset: 0,
      }),
    ).toEqual({ line: 3, col: 3 })
    expect(
      plainOffsetToPos({
        plainText,
        srcFrom: 3,
        srcTo: 3,
        sourceLines,
        offset: 6,
      }),
    ).toEqual({ line: 3, col: 9 })
  })

  it('maps multiline plain text through a fenced code block', () => {
    const sourceLines = ['```ts', 'one', 'two', '```']
    const plainText = 'one\ntwo'
    expect(
      plainOffsetToPos({
        plainText,
        srcFrom: 10,
        srcTo: 13,
        sourceLines,
        offset: 0,
      }),
    ).toEqual({ line: 11, col: 1 })
    expect(
      plainOffsetToPos({
        plainText,
        srcFrom: 10,
        srcTo: 13,
        sourceLines,
        offset: 4,
      }),
    ).toEqual({ line: 12, col: 1 })
    expect(
      plainOffsetToPos({
        plainText,
        srcFrom: 10,
        srcTo: 13,
        sourceLines,
        offset: 6,
      }),
    ).toEqual({ line: 12, col: 3 })
  })

  it('pins wrapped paragraph endpoints to srcFrom/srcTo', () => {
    const sourceLines = ['hello', 'world']
    const plainText = 'hello world'
    expect(
      plainOffsetToPos({
        plainText,
        srcFrom: 4,
        srcTo: 5,
        sourceLines,
        offset: 0,
      }),
    ).toEqual({ line: 4, col: 1 })
    expect(
      plainOffsetToPos({
        plainText,
        srcFrom: 4,
        srcTo: 5,
        sourceLines,
        offset: plainText.length,
      }),
    ).toEqual({ line: 5, col: 6 })
  })
})

describe('offsetsToSourceRange', () => {
  it('builds a LEFT range for a partial single-line selection', () => {
    const range = offsetsToSourceRange(
      {
        side: 'LEFT',
        srcFrom: 2,
        srcTo: 2,
        plainText: 'Hello world',
        sourceLines: ['Hello world'],
      },
      0,
      5,
      'Hello',
    )
    expect(range).toEqual({
      side: 'LEFT',
      startLine: 2,
      startCol: 1,
      endLine: 2,
      endCol: 6,
      quotedText: 'Hello',
    })
  })

  it('normalizes reversed offsets', () => {
    const range = offsetsToSourceRange(
      {
        side: 'RIGHT',
        srcFrom: 1,
        srcTo: 1,
        plainText: 'abcd',
        sourceLines: ['abcd'],
      },
      4,
      1,
      'bcd',
    )
    expect(range.startCol).toBe(2)
    expect(range.endCol).toBe(5)
  })
})

describe('mergeSourceRanges', () => {
  it('merges same-side ranges in document order', () => {
    const a: SourceRange = {
      side: 'RIGHT',
      startLine: 1,
      startCol: 1,
      endLine: 1,
      endCol: 4,
      quotedText: 'One',
    }
    const b: SourceRange = {
      side: 'RIGHT',
      startLine: 3,
      startCol: 1,
      endLine: 3,
      endCol: 5,
      quotedText: 'Two',
    }
    expect(mergeSourceRanges(a, b)).toEqual({
      side: 'RIGHT',
      startLine: 1,
      startCol: 1,
      endLine: 3,
      endCol: 5,
      quotedText: 'OneTwo',
    })
  })

  it('rejects cross-side merges', () => {
    expect(
      mergeSourceRanges(
        {
          side: 'LEFT',
          startLine: 1,
          startCol: 1,
          endLine: 1,
          endCol: 2,
          quotedText: 'a',
        },
        {
          side: 'RIGHT',
          startLine: 1,
          startCol: 1,
          endLine: 1,
          endCol: 2,
          quotedText: 'a',
        },
      ),
    ).toBeNull()
  })
})
