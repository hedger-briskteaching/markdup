/**
 * Hide GitHub header controls that conflict with the rich Markdown view.
 * Mirror GitHub file collapse state onto the rich root.
 * Re-apply suppression when GitHub re-renders the header.
 */

const SUPPRESSED_ATTR = "data-rgm-rich-suppressed";
export const FILE_COLLAPSED_ATTR = "data-rgm-file-collapsed";

/** GitHub CSS-module class stamped on the file header when collapsed. */
const COLLAPSED_HEADER_CLASS = '[class*="DiffFileHeader-module__collapsed"]';

const CHEVRON_ICON =
  'svg.octicon-chevron-down, svg.octicon-chevron-right, [class*="Chevron"], [class*="chevron"]';

type SuppressBinding = {
  observer: MutationObserver;
};

type CollapseBinding = {
  observer: MutationObserver;
};

const suppressBindings = new WeakMap<Element, SuppressBinding>();
const collapseBindings = new WeakMap<Element, CollapseBinding>();

/**
 * Mark an element as suppressed with hidden and aria attributes.
 * @param el - The element to suppress.
 * @returns Nothing.
 */
function suppress(el: HTMLElement): void {
  el.setAttribute(SUPPRESSED_ATTR, "");
  el.setAttribute("hidden", "");
  el.setAttribute("aria-hidden", "true");
}

/**
 * Remove suppression attributes from an element.
 * @param el - The element to restore.
 * @returns Nothing.
 */
function unsuppress(el: HTMLElement): void {
  el.removeAttribute(SUPPRESSED_ATTR);
  el.removeAttribute("hidden");
  el.removeAttribute("aria-hidden");
}

/**
 * Collect all header buttons that are not inside Markdup UI elements.
 * @param region - The file region element.
 * @returns Array of header button elements.
 */
function headerButtons(region: Element): HTMLElement[] {
  const header = region.querySelector("[data-diff-header-wrapper]");
  if (!header) return [];
  return [...header.querySelectorAll<HTMLElement>('button, a[role="button"]')].filter(
    (el) => !el.closest("[data-rgm-toggle], [data-rgm-rich]"),
  );
}

/**
 * Resolve the accessible label of a header control element.
 * Handles Primer tooltip labels wired through aria-labelledby.
 * @param el - The control element.
 * @returns Lowercase label text.
 */
function controlLabel(el: HTMLElement): string {
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const text = labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent ?? "")
      .join(" ")
      .trim();
    if (text) return text.toLowerCase();
  }
  return (
    el.getAttribute("aria-label") ??
    el.getAttribute("title") ??
    el.textContent ??
    ""
  ).toLowerCase();
}

/**
 * Find the file-section collapse/expand chevron button.
 * Prefer the chevron octicon. GitHub no longer sets aria-expanded.
 * @param region - The file region element.
 * @returns The collapse button, or null if not found.
 */
export function findFileCollapseButton(region: Element): HTMLElement | null {
  const buttons = headerButtons(region);

  const byChevron = buttons.find((btn) => Boolean(btn.querySelector(CHEVRON_ICON)));
  if (byChevron) return byChevron;

  const byLabel = buttons.find((btn) => {
    const label = controlLabel(btn);
    return (
      /\bcollapse file\b/.test(label) ||
      /\bexpand file\b/.test(label) ||
      label === "collapse" ||
      label === "expand"
    );
  });
  return byLabel ?? null;
}

/**
 * Find the "Expand all lines" button. This is source-diff only.
 * Hide it while rich mode is on.
 * @param region - The file region element.
 * @returns The button element, or null if not found.
 */
export function findExpandAllLinesButton(region: Element): HTMLElement | null {
  const buttons = headerButtons(region);

  const byLabel = buttons.find((btn) => controlLabel(btn).includes("expand all lines"));
  if (byLabel) return byLabel;

  return (
    buttons.find((btn) => Boolean(btn.querySelector("svg.octicon-unfold, .octicon-unfold"))) ?? null
  );
}

/**
 * Find the "Viewed" or "Not Viewed" control in the header.
 * @param region - The file region element.
 * @returns The control element, or null if not found.
 */
export function findViewedControl(region: Element): HTMLElement | null {
  const header = region.querySelector("[data-diff-header-wrapper]") ?? region;

  const byLabel = header.querySelector<HTMLElement>(
    'button[aria-label="Viewed"], button[aria-label="Not Viewed"]',
  );
  if (byLabel && !byLabel.closest("[data-rgm-toggle], [data-rgm-rich]")) {
    return byLabel;
  }

  const checkbox = header.querySelector<HTMLInputElement>('input[type="checkbox"][name="viewed"]');
  if (checkbox) return checkbox;

  for (const btn of headerButtons(region)) {
    const label = controlLabel(btn).trim();
    if (label === "viewed" || label === "not viewed") {
      return btn;
    }
  }

  return null;
}

/**
 * Find the "Comment on this file" button by label, title, or comment octicon.
 * @param region - The file region element.
 * @returns The button element, or null if not found.
 */
export function findFileCommentButton(region: Element): HTMLElement | null {
  const buttons = headerButtons(region);

  const byLabel = buttons.find((btn) => {
    const label = controlLabel(btn);
    return (
      label.includes("comment on this file") || label === "comment" || /^comment\b/.test(label)
    );
  });
  if (byLabel) return byLabel;

  const byIcon = buttons.find((btn) =>
    Boolean(
      btn.querySelector("svg.octicon-comment, .octicon-comment, .octicon-comment-discussion"),
    ),
  );
  if (byIcon) return byIcon;

  const byClass = buttons.find((btn) => Boolean(btn.querySelector('[class*="CommentIcon"]')));
  return byClass ?? null;
}

/**
 * Determine if GitHub currently has this file section collapsed.
 * Uses DiffFileHeader-module__collapsed and chevron direction.
 * @param region - The file region element.
 * @returns True when the file section is collapsed.
 */
export function isFileCollapsed(region: Element): boolean {
  const header = region.querySelector("[data-diff-header-wrapper]");
  if (!header) return false;

  if (header.querySelector(COLLAPSED_HEADER_CLASS)) {
    return true;
  }

  if (header.querySelector("svg.octicon-chevron-right")) {
    return true;
  }
  if (header.querySelector("svg.octicon-chevron-down")) {
    return false;
  }

  return false;
}

/**
 * Stamp or clear data-rgm-file-collapsed so CSS can hide the rich root.
 * @param region - The file region element.
 * @returns Nothing.
 */
export function syncFileCollapsedState(region: Element): void {
  region.toggleAttribute(FILE_COLLAPSED_ATTR, isFileCollapsed(region));
}

/**
 * Watch GitHub header class and chevron swaps to mirror collapse state.
 * Safe to call many times while rich mode is mounted. Idempotent.
 * @param region - The file region element.
 * @returns Nothing.
 */
export function bindFileCollapseSync(region: Element): void {
  syncFileCollapsedState(region);
  if (collapseBindings.has(region)) {
    return;
  }

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      syncFileCollapsedState(region);
    });
  });
  observer.observe(region, {
    attributes: true,
    attributeFilter: ["class"],
    subtree: true,
    childList: true,
  });
  collapseBindings.set(region, { observer });
}

/**
 * Disconnect the collapse-sync observer and remove the collapsed attribute.
 * @param region - The file region element.
 * @returns Nothing.
 */
export function unbindFileCollapseSync(region: Element): void {
  const binding = collapseBindings.get(region);
  if (!binding) return;
  binding.observer.disconnect();
  collapseBindings.delete(region);
  region.removeAttribute(FILE_COLLAPSED_ATTR);
}

/**
 * Hide Viewed, file-comment, and Expand-all while rich mode is active.
 * The file-collapse chevron stays visible so users can fold the section.
 * @param region - The file region element.
 * @returns Nothing.
 */
export function hideInterferingHeaderControls(region: Element): void {
  for (const el of [
    findViewedControl(region),
    findFileCommentButton(region),
    findExpandAllLinesButton(region),
  ]) {
    if (el) suppress(el);
  }
}

/**
 * Restore controls previously hidden for rich mode.
 * @param region - The file region element.
 * @returns Nothing.
 */
export function showInterferingHeaderControls(region: Element): void {
  unbindHeaderControlSuppress(region);
  const header = region.querySelector("[data-diff-header-wrapper]") ?? region;
  for (const el of header.querySelectorAll<HTMLElement>(`[${SUPPRESSED_ATTR}]`)) {
    unsuppress(el);
  }
}

/**
 * Keep Viewed, Comment, and Expand-all suppressed across GitHub header
 * re-renders for as long as rich mode is mounted.
 * @param region - The file region element.
 * @returns Nothing.
 */
export function bindHeaderControlSuppress(region: Element): void {
  hideInterferingHeaderControls(region);
  if (suppressBindings.has(region)) {
    return;
  }

  const header = region.querySelector("[data-diff-header-wrapper]") ?? region;
  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      hideInterferingHeaderControls(region);
    });
  });
  observer.observe(header, {
    childList: true,
    subtree: true,
  });
  suppressBindings.set(region, { observer });
}

/**
 * Disconnect the header-control suppression observer.
 * @param region - The file region element.
 * @returns Nothing.
 */
export function unbindHeaderControlSuppress(region: Element): void {
  const binding = suppressBindings.get(region);
  if (!binding) return;
  binding.observer.disconnect();
  suppressBindings.delete(region);
}
