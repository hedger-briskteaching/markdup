import { describe, expect, it } from 'vitest'
import { createPayloadFromRange } from '../../shared/reviewComment'
import {
  buildThreads,
  type PullReviewComment,
} from './pulls'

function comment(
  partial: Partial<PullReviewComment> & Pick<PullReviewComment, 'id' | 'body'>,
): PullReviewComment {
  return {
    path: 'docs/PLAN.md',
    side: 'RIGHT',
    line: 10,
    startLine: null,
    originalLine: null,
    inReplyToId: null,
    userLogin: 'alice',
    createdAt: '2026-01-01T00:00:00Z',
    commitId: 'abc',
    htmlUrl: 'https://github.com/o/r/pull/1#discussion_r1',
    ...partial,
  }
}

describe('buildThreads', () => {
  it('groups replies under the root comment', () => {
    const threads = buildThreads([
      comment({ id: 1, body: 'root', line: 4, startLine: 2 }),
      comment({
        id: 2,
        body: 'reply',
        inReplyToId: 1,
        createdAt: '2026-01-01T01:00:00Z',
      }),
      comment({ id: 3, body: 'other', line: 20, path: 'docs/PLAN.md' }),
    ])

    expect(threads).toHaveLength(2)
    expect(threads[0]).toMatchObject({
      rootId: 1,
      startLine: 2,
      line: 4,
      side: 'RIGHT',
    })
    expect(threads[0]!.comments.map((c) => c.id)).toEqual([1, 2])
    expect(threads[1]!.rootId).toBe(3)
  })

  it('skips comments without a side or line', () => {
    const threads = buildThreads([
      comment({ id: 1, body: 'x', side: null, line: null }),
      comment({ id: 2, body: 'y', line: 3 }),
    ])
    expect(threads).toHaveLength(1)
    expect(threads[0]!.rootId).toBe(2)
  })
})

describe('createPayloadFromRange', () => {
  it('omits start_line for a single-line range', () => {
    expect(
      createPayloadFromRange({
        body: 'nit',
        path: 'a.md',
        commitId: 'sha',
        side: 'RIGHT',
        startLine: 5,
        endLine: 5,
      }),
    ).toEqual({
      path: 'a.md',
      body: 'nit',
      commitId: 'sha',
      side: 'RIGHT',
      line: 5,
    })
  })

  it('includes start_line for a multi-line range', () => {
    expect(
      createPayloadFromRange({
        body: 'please expand',
        path: 'a.md',
        commitId: 'sha',
        side: 'LEFT',
        startLine: 3,
        endLine: 7,
      }),
    ).toEqual({
      path: 'a.md',
      body: 'please expand',
      commitId: 'sha',
      side: 'LEFT',
      line: 7,
      startLine: 3,
      startSide: 'LEFT',
    })
  })
})
