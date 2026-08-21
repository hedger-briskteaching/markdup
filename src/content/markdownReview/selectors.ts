/** CSS selectors for GitHub PR "Files changed" UI elements. */

/** File region wrapper identified by role and diff-prefixed id. */
export const FILE_REGION = 'div[role="region"][id^="diff-"]';

/** Header wrapper that contains file path and action buttons. */
export const DIFF_HEADER_WRAPPER = "[data-diff-header-wrapper]";

/** Button carrying the file path as a data attribute. */
export const FILE_PATH_BUTTON = "button[data-file-path]";

/** Container that holds progressively loaded diff entries. */
export const PROGRESSIVE_DIFFS_LIST = '[data-testid="progressive-diffs-list"]';

/** Markdup rich/source toggle control injected by this extension. */
export const RGM_TOGGLE = "[data-rgm-toggle]";

/** Stub container for the rich markdown view. */
export const RGM_STUB = "[data-rgm-stub]";

/** Authentication panel injected when token is missing. */
export const RGM_AUTH_PANEL = "[data-rgm-auth-panel]";

/** Native diff body container that wraps the diff table. */
export const DIFF_BODY =
  'div.border.position-relative.rounded-bottom-2:has(table[aria-label^="Diff for:"])';

/** Three-dot kebab menu icon in the file header. */
export const KEBAB_ICON = ".octicon-kebab-horizontal";

/** Flex container for action buttons in the file header. */
export const HEADER_ACTIONS = "div.d-flex.flex-items-center.gap-2";

/** GitHub native source/rich file-view segmented control. */
export const FILE_VIEW_SEGMENTED =
  'ul[data-component="SegmentedControl"][aria-label="File view"]:not([data-rgm-toggle])';
