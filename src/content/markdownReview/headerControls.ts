/**
 * Hide GitHub header controls that conflict with rich Markdown view.
 * Re-applies suppression when GitHub re-renders the header.
 */

const SUPPRESSED_ATTR = 'data-rgm-rich-suppressed'

type SuppressBinding = {
  observer: MutationObserver
}

const suppressBindings = new WeakMap<Element, SuppressBinding>()

function suppress(el: HTMLElement): void {
  el.setAttribute(SUPPRESSED_ATTR, '')
  el.setAttribute('hidden', '')
  el.setAttribute('aria-hidden', 'true')
}

function unsuppress(el: HTMLElement): void {
  el.removeAttribute(SUPPRESSED_ATTR)
  el.removeAttribute('hidden')
  el.removeAttribute('aria-hidden')
}

function headerButtons(region: Element): HTMLElement[] {
  const header = region.querySelector('[data-diff-header-wrapper]')
  if (!header) return []
  return [...header.querySelectorAll<HTMLElement>('button, a[role="button"]')].filter(
    (el) => !el.closest('[data-rgm-toggle], [data-rgm-rich]'),
  )
}

function controlLabel(el: HTMLElement): string {
  return (
    el.getAttribute('aria-label') ??
    el.getAttribute('title') ??
    el.getAttribute('aria-labelledby') ??
    el.textContent ??
    ''
  ).toLowerCase()
}

/**
 * File-section chevron (Expand/Collapse file). Prefer labeled / chevron
 * buttons; fall back to the first header button with aria-expanded.
 */
export function findFileCollapseButton(region: Element): HTMLElement | null {
  const buttons = headerButtons(region)

  const byLabel = buttons.find((btn) => {
    const label = controlLabel(btn)
    return (
      /\bcollapse\b/.test(label) ||
      /\bexpand\b/.test(label) ||
      /\bfold\b/.test(label)
    )
  })
  if (byLabel) return byLabel

  const byChevron = buttons.find((btn) =>
    Boolean(
      btn.querySelector(
        '.octicon-chevron-down, .octicon-chevron-right, [class*="Chevron"], [class*="chevron"]',
      ),
    ),
  )
  if (byChevron) return byChevron

  const first = buttons[0]
  if (first?.hasAttribute('aria-expanded')) {
    return first
  }

  return null
}

/** Viewed / Not Viewed control. */
export function findViewedControl(region: Element): HTMLElement | null {
  const header = region.querySelector('[data-diff-header-wrapper]') ?? region

  const byLabel = header.querySelector<HTMLElement>(
    'button[aria-label="Viewed"], button[aria-label="Not Viewed"]',
  )
  if (byLabel && !byLabel.closest('[data-rgm-toggle], [data-rgm-rich]')) {
    return byLabel
  }

  const checkbox = header.querySelector<HTMLInputElement>(
    'input[type="checkbox"][name="viewed"]',
  )
  if (checkbox) return checkbox

  for (const btn of headerButtons(region)) {
    const label = controlLabel(btn).trim()
    if (label === 'viewed' || label === 'not viewed') {
      return btn
    }
  }

  return null
}

/**
 * "Comment on this file" header control — label, title, or comment octicon.
 */
export function findFileCommentButton(region: Element): HTMLElement | null {
  const buttons = headerButtons(region)

  const byLabel = buttons.find((btn) => {
    const label = controlLabel(btn)
    return (
      label.includes('comment on this file') ||
      label === 'comment' ||
      /^comment\b/.test(label)
    )
  })
  if (byLabel) return byLabel

  const byIcon = buttons.find((btn) =>
    Boolean(
      btn.querySelector(
        'svg.octicon-comment, .octicon-comment, .octicon-comment-discussion',
      ),
    ),
  )
  if (byIcon) return byIcon

  // Primer / React icon components sometimes expose the name in className.
  const byClass = buttons.find((btn) =>
    Boolean(btn.querySelector('[class*="CommentIcon"]')),
  )
  return byClass ?? null
}

/** Hide collapse / Viewed / file-comment while rich mode is active. */
export function hideInterferingHeaderControls(region: Element): void {
  for (const el of [
    findFileCollapseButton(region),
    findViewedControl(region),
    findFileCommentButton(region),
  ]) {
    if (el) suppress(el)
  }
}

/** Restore controls previously hidden for rich mode. */
export function showInterferingHeaderControls(region: Element): void {
  unbindHeaderControlSuppress(region)
  const header = region.querySelector('[data-diff-header-wrapper]') ?? region
  for (const el of header.querySelectorAll<HTMLElement>(
    `[${SUPPRESSED_ATTR}]`,
  )) {
    unsuppress(el)
  }
}

/**
 * Keep collapse / Viewed / Comment suppressed across GitHub header re-renders
 * for as long as rich mode is mounted.
 */
export function bindHeaderControlSuppress(region: Element): void {
  hideInterferingHeaderControls(region)
  if (suppressBindings.has(region)) {
    return
  }

  const header =
    region.querySelector('[data-diff-header-wrapper]') ?? region
  let scheduled = false
  const observer = new MutationObserver(() => {
    if (scheduled) return
    scheduled = true
    queueMicrotask(() => {
      scheduled = false
      // Only childList-driven reappearance matters; attribute churn from our
      // own suppress() must not re-enter forever.
      hideInterferingHeaderControls(region)
    })
  })
  observer.observe(header, {
    childList: true,
    subtree: true,
  })
  suppressBindings.set(region, { observer })
}

export function unbindHeaderControlSuppress(region: Element): void {
  const binding = suppressBindings.get(region)
  if (!binding) return
  binding.observer.disconnect()
  suppressBindings.delete(region)
}
