import type { Node as PMNode } from 'prosemirror-model'
import {
  isMermaidFrameMessage,
  MERMAID_FRAME_PATH,
  type MermaidFrameMetrics,
  type MermaidRenderRequest,
  type MermaidTheme,
} from './mermaidProtocol'

const FRAME_MIN_HEIGHT = 180
const FRAME_WIDTH_RATIO = 0.9

const cleanups = new WeakMap<HTMLElement, () => void>()

/** Return true for a fenced code block whose language is Mermaid. */
export function isMermaidBlock(node: PMNode): boolean {
  return (
    node.type.name === 'code_block' &&
    String(node.attrs.params ?? '').trim().toLowerCase() === 'mermaid'
  )
}

/** Build an interactive, sandboxed Mermaid diagram with a source fallback. */
export function renderMermaidDiagram(source: string): HTMLElement {
  const figure = document.createElement('figure')
  figure.className = 'rgm-mermaid'
  figure.setAttribute('data-rgm-mermaid', '')

  const frame = document.createElement('iframe')
  frame.className = 'rgm-mermaid-frame'
  frame.title = 'Interactive Mermaid diagram'
  frame.setAttribute('aria-busy', 'true')
  frame.src = mermaidFrameUrl()
  frame.style.height = `${FRAME_MIN_HEIGHT}px`
  figure.appendChild(frame)

  const status = document.createElement('p')
  status.className = 'rgm-mermaid-status'
  status.setAttribute('data-rgm-chrome', '')
  status.textContent = 'Rendering diagram…'
  figure.appendChild(status)
  figure.appendChild(buildSourceDisclosure(source))

  const requestId = createRequestId()
  let loaded = false
  let timer = 0
  const resize =
    typeof ResizeObserver === 'function'
      ? new ResizeObserver(() => {
          const metrics = metricsFromFigure(figure)
          if (metrics) setFrameHeight(frame, metrics)
        })
      : null
  resize?.observe(figure)
  const themeObserver = new MutationObserver(() => {
    if (loaded) postRenderRequest(frame, requestId, source)
  })
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-color-mode'],
  })

  const onMessage = (event: MessageEvent<unknown>) => {
    if (event.source !== frame.contentWindow || !isMermaidFrameMessage(event.data)) {
      return
    }

    if (event.data.type === 'rgm:mermaid:ready') {
      loaded = true
      postRenderRequest(frame, requestId, source)
      return
    }
    if (event.data.requestId !== requestId) return

    if (event.data.type === 'rgm:mermaid:metrics') {
      figure.dataset.rgmMermaidWidth = String(event.data.width)
      figure.dataset.rgmMermaidHeight = String(event.data.height)
      setFrameHeight(frame, event.data)
      frame.removeAttribute('aria-busy')
      status.remove()
      return
    }

    frame.removeAttribute('aria-busy')
    status.textContent = `Diagram could not render: ${event.data.message}`
    status.classList.add('rgm-mermaid-status-error')
  }
  window.addEventListener('message', onMessage)

  frame.addEventListener('load', () => {
    // The ready event is the normal path. This only explains a sandbox or
    // build failure without hiding the selectable source fallback.
    timer = window.setTimeout(() => {
      if (!loaded) {
        status.textContent = 'Diagram renderer did not start. Use diagram source.'
        status.classList.add('rgm-mermaid-status-error')
      }
    }, 5_000)
  })

  cleanups.set(figure, () => {
    if (timer) window.clearTimeout(timer)
    resize?.disconnect()
    themeObserver.disconnect()
    window.removeEventListener('message', onMessage)
  })
  return figure
}

/** Release message listeners and observers for diagrams inside a removed view. */
export function disposeMermaidDiagrams(root: ParentNode): void {
  const ownFigure =
    root instanceof HTMLElement && root.matches('[data-rgm-mermaid]')
      ? [root]
      : []
  for (const figure of [
    ...ownFigure,
    ...root.querySelectorAll<HTMLElement>('[data-rgm-mermaid]'),
  ]) {
    cleanups.get(figure)?.()
    cleanups.delete(figure)
  }
}

function buildSourceDisclosure(source: string): HTMLDetailsElement {
  const details = document.createElement('details')
  details.className = 'rgm-mermaid-source'
  const summary = document.createElement('summary')
  summary.setAttribute('data-rgm-chrome', '')
  summary.textContent = 'Diagram source'

  const pre = document.createElement('pre')
  const code = document.createElement('code')
  const text = document.createElement('span')
  text.setAttribute('data-src-offset', '0')
  text.setAttribute('data-src-len', String(source.length))
  text.textContent = source
  code.appendChild(text)
  pre.appendChild(code)
  details.append(summary, pre)
  return details
}

function mermaidFrameUrl(): string {
  return (
    globalThis.chrome?.runtime?.getURL?.(MERMAID_FRAME_PATH) ??
    MERMAID_FRAME_PATH
  )
}

function postRenderRequest(
  frame: HTMLIFrameElement,
  requestId: string,
  source: string,
): void {
  const request: MermaidRenderRequest = {
    type: 'rgm:mermaid:render',
    requestId,
    source,
    theme: currentTheme(),
  }
  // This page is an opaque sandbox origin declared in the extension manifest,
  // so targetOrigin must be '*'. Accept replies from this exact WindowProxy.
  frame.contentWindow?.postMessage(request, '*')
}

function currentTheme(): MermaidTheme {
  return document.documentElement.getAttribute('data-color-mode') === 'dark'
    ? 'dark'
    : 'light'
}

function createRequestId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `mermaid-${Date.now()}-${Math.random()}`
  )
}

function metricsFromFigure(figure: HTMLElement): MermaidFrameMetrics | null {
  const width = Number(figure.dataset.rgmMermaidWidth)
  const height = Number(figure.dataset.rgmMermaidHeight)
  if (!(width > 0) || !(height > 0)) return null
  return { type: 'rgm:mermaid:metrics', requestId: '', width, height }
}

function setFrameHeight(
  frame: HTMLIFrameElement,
  metrics: Pick<MermaidFrameMetrics, 'width' | 'height'>,
): void {
  const availableWidth = frame.getBoundingClientRect().width
  if (!(availableWidth > 0)) return
  frame.style.height = `${calculateMermaidFrameHeight(
    availableWidth,
    metrics.width,
    metrics.height,
  )}px`
}

/**
 * Calculate the smallest usable viewport height for a 90%-wide diagram while
 * retaining the SVG aspect ratio.
 */
export function calculateMermaidFrameHeight(
  availableWidth: number,
  graphWidth: number,
  graphHeight: number,
): number {
  const requiredHeight = Math.ceil(
    graphHeight * ((availableWidth * FRAME_WIDTH_RATIO) / graphWidth),
  )
  return Math.max(FRAME_MIN_HEIGHT, requiredHeight)
}
