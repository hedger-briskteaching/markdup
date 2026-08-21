import { describe, expect, it } from 'vitest'
import { alignMarkdown } from '../../markdown/align'
import { markdownToDoc } from '../../markdown'
import {
  calculateMermaidFrameHeight,
  disposeMermaidDiagrams,
  isMermaidBlock,
  renderMermaidDiagram,
} from './mermaid'
import { isMermaidFrameMessage } from './mermaidProtocol'
import { buildRichRoot } from './renderBody'

describe('Mermaid rich rendering', () => {
  it('recognizes Mermaid code blocks without changing other fences', () => {
    const mermaid = markdownToDoc('```mermaid\nflowchart LR\n  A --> B\n```').firstChild!
    const typescript = markdownToDoc('```ts\nconst x = 1\n```').firstChild!

    expect(isMermaidBlock(mermaid)).toBe(true)
    expect(isMermaidBlock(typescript)).toBe(false)
  })

  it('creates an extension frame and selectable source fallback', () => {
    const figure = renderMermaidDiagram('flowchart LR\n  A --> B')

    expect(figure.querySelector('iframe')?.title).toBe(
      'Interactive Mermaid diagram',
    )
    expect(figure.querySelector('details summary')?.textContent).toBe(
      'Diagram source',
    )
    expect(figure.querySelector('[data-src-offset="0"]')?.textContent).toContain(
      'A --> B',
    )

    disposeMermaidDiagrams(figure)
  })

  it('uses the diagram renderer in the rich diff without changing other code blocks', () => {
    const host = document.createElement('div')
    const rows = alignMarkdown(
      '',
      '```mermaid\nflowchart LR\n  A --> B\n```\n\n```ts\nconst x = 1\n```',
    )
    host.appendChild(buildRichRoot(rows, new Set()))

    expect(host.querySelector('[data-rgm-mermaid]')).not.toBeNull()
    expect(host.querySelector('pre[data-params="ts"]')).not.toBeNull()
    disposeMermaidDiagrams(host)
  })

  it('sizes the starting viewport from the graph aspect ratio', () => {
    // A 1000 × 500 graph in an 800px frame starts 720px wide and 360px high.
    expect(calculateMermaidFrameHeight(800, 1000, 500)).toBe(360)
    // Small charts retain space for the interaction controls and error state.
    expect(calculateMermaidFrameHeight(200, 1000, 100)).toBe(180)
  })

  it('accepts only the expected frame messages', () => {
    expect(isMermaidFrameMessage({ type: 'rgm:mermaid:ready' })).toBe(true)
    expect(
      isMermaidFrameMessage({
        type: 'rgm:mermaid:metrics',
        requestId: 'one',
        width: 800,
        height: 400,
      }),
    ).toBe(true)
    expect(
      isMermaidFrameMessage({
        type: 'rgm:mermaid:metrics',
        requestId: 'one',
        width: 0,
        height: 400,
      }),
    ).toBe(false)
    expect(isMermaidFrameMessage({ type: 'some-other-message' })).toBe(false)
  })
})
