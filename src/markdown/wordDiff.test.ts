import { describe, expect, it } from 'vitest'
import { wordDiff } from './wordDiff'

describe('wordDiff', () => {
  it('marks inserted words only on the new side', () => {
    const { oldSegments, newSegments } = wordDiff(
      'Hello world.',
      'Hello brave world.',
    )
    expect(oldSegments.every((s) => s.tone !== 'ins')).toBe(true)
    expect(newSegments.some((s) => s.tone === 'ins' && s.text.includes('brave'))).toBe(
      true,
    )
  })

  it('marks deleted words only on the old side', () => {
    const { oldSegments, newSegments } = wordDiff(
      'needs its own ticket',
      'tracked as BRI-6163',
    )
    expect(oldSegments.some((s) => s.tone === 'del')).toBe(true)
    expect(newSegments.some((s) => s.tone === 'ins')).toBe(true)
    expect(newSegments.every((s) => s.tone !== 'del')).toBe(true)
  })

  it('returns plain segments when texts match', () => {
    const { oldSegments, newSegments } = wordDiff('same', 'same')
    expect(oldSegments).toEqual([{ text: 'same' }])
    expect(newSegments).toEqual([{ text: 'same' }])
  })
})
