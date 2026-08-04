import { DIFF_BODY, RGM_STUB } from './selectors'

const HIDDEN_ATTR = 'data-rgm-diff-hidden'

function findDiffBody(region: Element): HTMLElement | null {
  const header = region.querySelector('[data-diff-header-wrapper]')
  if (header?.parentElement === region) {
    let sibling = header.nextElementSibling
    while (sibling) {
      if (
        sibling instanceof HTMLElement &&
        sibling.querySelector('table[aria-label^="Diff for:"]')
      ) {
        return sibling
      }
      sibling = sibling.nextElementSibling
    }
  }

  return region.querySelector<HTMLElement>(DIFF_BODY)
}

function buildStub(): HTMLElement {
  const stub = document.createElement('div')
  stub.setAttribute('data-rgm-stub', '')
  stub.innerHTML = `
    <div class="rgm-stub-pane">
      <p class="rgm-stub-label">Old</p>
      <p class="rgm-stub-placeholder">Rich markdown view (coming soon)</p>
    </div>
    <div class="rgm-stub-pane">
      <p class="rgm-stub-label">New</p>
      <p class="rgm-stub-placeholder">Rich markdown view (coming soon)</p>
    </div>
  `
  return stub
}

export function showRichStub(region: Element): void {
  const diffBody = findDiffBody(region)
  if (!diffBody) {
    return
  }

  diffBody.setAttribute(HIDDEN_ATTR, '')

  let stub = region.querySelector<HTMLElement>(RGM_STUB)
  if (!stub) {
    stub = buildStub()
    diffBody.after(stub)
  }
}

export function hideRichStub(region: Element): void {
  const diffBody = findDiffBody(region)
  diffBody?.removeAttribute(HIDDEN_ATTR)

  region.querySelector(RGM_STUB)?.remove()
}

export function isRichMode(region: Element): boolean {
  return region.getAttribute('data-rgm-mode') === 'rich'
}

export function setRichMode(region: Element, rich: boolean): void {
  if (rich) {
    region.setAttribute('data-rgm-mode', 'rich')
    showRichStub(region)
  } else {
    region.removeAttribute('data-rgm-mode')
    hideRichStub(region)
  }
}
