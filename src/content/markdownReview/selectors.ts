/** Centralized selectors for GitHub's new PR Files changed UI. */

export const FILE_REGION = 'div[role="region"][id^="diff-"]'

export const DIFF_HEADER_WRAPPER = '[data-diff-header-wrapper]'

export const FILE_PATH_BUTTON = 'button[data-file-path]'

export const PROGRESSIVE_DIFFS_LIST = '[data-testid="progressive-diffs-list"]'

export const RGM_TOGGLE = '[data-rgm-toggle]'

export const RGM_STUB = '[data-rgm-stub]'

export const RGM_AUTH_PANEL = '[data-rgm-auth-panel]'

export const DIFF_BODY =
  'div.border.position-relative.rounded-bottom-2:has(table[aria-label^="Diff for:"])'

export const KEBAB_ICON = '.octicon-kebab-horizontal'

export const HEADER_ACTIONS = 'div.d-flex.flex-items-center.gap-2'

/** GitHub's native source / rich file-view segmented control. */
export const FILE_VIEW_SEGMENTED =
  'ul[data-component="SegmentedControl"][aria-label="File view"]:not([data-rgm-toggle])'
