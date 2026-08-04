import { isRichMode, setRichMode } from './richStub'
import {
  DIFF_HEADER_WRAPPER,
  HEADER_ACTIONS,
  KEBAB_ICON,
  RGM_TOGGLE,
} from './selectors'

const MARKDOWN_ICON = `
<svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16">
  <path d="M14.85 3H1.15C.52 3 0 3.52 0 4.15v7.69C0 12.48.52 13 1.15 13h13.69c.64 0 1.15-.52 1.15-1.15v-7.7C16 3.52 15.48 3 14.85 3zM9 11H7V8L5.5 9.92 4 8v3H2V5h2l1.5 2L7 5h2v6zm2.99.5L9.5 8H11V5h2v3h1.5l-2.51 3.5z"/>
</svg>
`.trim()

function findKebabButton(region: Element): HTMLElement | null {
  const header = region.querySelector(DIFF_HEADER_WRAPPER) ?? region
  const buttons = header.querySelectorAll<HTMLElement>('button')
  for (const button of buttons) {
    if (button.querySelector(KEBAB_ICON)) {
      return button
    }
    const label = (
      button.getAttribute('aria-label') ??
      button.getAttribute('aria-labelledby') ??
      ''
    ).toLowerCase()
    if (label.includes('more options')) {
      return button
    }
  }
  return null
}

function findActionsContainer(region: Element): HTMLElement | null {
  const kebab = findKebabButton(region)
  if (kebab?.parentElement) {
    return kebab.parentElement
  }

  const header = region.querySelector(DIFF_HEADER_WRAPPER) ?? region
  return header.querySelector<HTMLElement>(HEADER_ACTIONS)
}

function createToggleButton(path: string, region: Element): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.setAttribute('data-rgm-toggle', '')
  button.setAttribute('data-rgm-file', path)
  button.setAttribute('aria-label', 'Rich markdown view')
  button.setAttribute('aria-pressed', 'false')
  button.title = 'Rich markdown view'
  button.innerHTML = MARKDOWN_ICON

  button.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()

    const next = !isRichMode(region)
    setRichMode(region, next)
    button.setAttribute('aria-pressed', String(next))
  })

  return button
}

/** Inject toggle left of kebab for a markdown file region. Idempotent. */
export function injectToggle(region: Element, path: string): void {
  if (region.querySelector(RGM_TOGGLE)) {
    return
  }

  const button = createToggleButton(path, region)
  const kebab = findKebabButton(region)

  if (kebab) {
    kebab.before(button)
    return
  }

  const actions = findActionsContainer(region)
  if (actions) {
    actions.appendChild(button)
  }
}
