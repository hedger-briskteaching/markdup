/**
 * Hide GitHub header controls that conflict with rich Markdown view.
 * Mirror GitHub's file collapse state onto our rich root.
 * Re-applies suppression when GitHub re-renders the header.
 */

const SUPPRESSED_ATTR = 'data-rgm-rich-suppressed'
export const FILE_COLLAPSED_ATTR = 'data-rgm-file-collapsed'

/** GitHub CSS-module class stamped on the file header when collapsed. */
const COLLAPSED_HEADER_CLASS = '[class*="DiffFileHeader-module__collapsed"]'

const CHEVRON_ICON =
  'svg.octicon-chevron-down, svg.octicon-chevron-right, [class*="Chevron"], [class*="chevron"]'

type SuppressBinding = {
  observer: MutationObserver
}

type CollapseBinding = {
  observer: MutationObserver
}

const suppressBindings = new WeakMap<Element, SuppressBinding>()
const collapseBindings = new WeakMap<Element, CollapseBinding>()

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

/** Resolve Primer tooltip labels wired through aria-labelledby. */
function controlLabel(el: HTMLElement): string {
  const labelledBy = el.getAttribute('aria-labelledby')
  if (labelledBy) {
    const text = labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent ?? '')
      .join(' ')
      .trim()
    if (text) return text.toLowerCase()
  }
  return (
    el.getAttribute('aria-label') ??
    el.getAttribute('title') ??
    el.textContent ??
    ''
  ).toLowerCase()
}

/**
 * File-section chevron (Expand/Collapse file).
 * Prefer the chevron octicon — GitHub no longer sets aria-expanded, and a
 * bare /\bexpand\b/ label match wrongly hits "Expand all lines".
 */
export function findFileCollapseButton(region: Element): HTMLElement | null {
  const buttons = headerButtons(region)

  const byChevron = buttons.find((btn) =>
    Boolean(btn.querySelector(CHEVRON_ICON)),
  )
  if (byChevron) return byChevron

  const byLabel = buttons.find((btn) => {
    const label = controlLabel(btn)
    return (
      /\bcollapse file\b/.test(label) ||
      /\bexpand file\b/.test(label) ||
      label === 'collapse' ||
      label === 'expand'
    )
  })
  return byLabel ?? null
}

/** "Expand all lines" — source-diff only; hide while rich mode is on. */
export function findExpandAllLinesButton(region: Element): HTMLElement | null {
  const buttons = headerButtons(region)

  const byLabel = buttons.find((btn) =>
    controlLabel(btn).includes('expand all lines'),
  )
  if (byLabel) return byLabel

  return (
    buttons.find((btn) =>
      Boolean(btn.querySelector('svg.octicon-unfold, .octicon-unfold')),
    ) ?? null
  )
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

/**
 * Whether GitHub currently has this file section collapsed.
 * Relies on DiffFileHeader-module__collapsed and/or chevron-right —
 * the chevron itself has no aria-expanded in the new Files UI.
 */
export function isFileCollapsed(region: Element): boolean {
  const header = region.querySelector('[data-diff-header-wrapper]')
  if (!header) return false

  if (header.querySelector(COLLAPSED_HEADER_CLASS)) {
    return true
  }

  // Prefer explicit chevron direction when present.
  if (header.querySelector('svg.octicon-chevron-right')) {
    return true
  }
  if (header.querySelector('svg.octicon-chevron-down')) {
    return false
  }

  return false
}

/** Stamp / clear data-rgm-file-collapsed so CSS can hide the rich root. */
export function syncFileCollapsedState(region: Element): void {
  region.toggleAttribute(FILE_COLLAPSED_ATTR, isFileCollapsed(region))
}

/**
 * Watch GitHub's header class / chevron swaps and mirror collapse onto the
 * region. Safe to call repeatedly while rich mode is mounted.
 */
export function bindFileCollapseSync(region: Element): void {
  syncFileCollapsedState(region)
  if (collapseBindings.has(region)) {
    return
  }

  let scheduled = false
  const observer = new MutationObserver(() => {
    if (scheduled) return
    scheduled = true
    queueMicrotask(() => {
      scheduled = false
      syncFileCollapsedState(region)
    })
  })
  observer.observe(region, {
    attributes: true,
    attributeFilter: ['class'],
    subtree: true,
    childList: true,
  })
  collapseBindings.set(region, { observer })
}

export function unbindFileCollapseSync(region: Element): void {
  const binding = collapseBindings.get(region)
  if (!binding) return
  binding.observer.disconnect()
  collapseBindings.delete(region)
  region.removeAttribute(FILE_COLLAPSED_ATTR)
}

/**
 * Hide Viewed / file-comment / Expand-all while rich mode is active.
 * The file-collapse chevron stays visible so users can fold the section.
 */
export function hideInterferingHeaderControls(region: Element): void {
  for (const el of [
    findViewedControl(region),
    findFileCommentButton(region),
    findExpandAllLinesButton(region),
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
 * Keep Viewed / Comment / Expand-all suppressed across GitHub header
 * re-renders for as long as rich mode is mounted.
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
