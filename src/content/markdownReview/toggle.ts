import type { AuthStatusResponse, ExtensionEvent } from "../../shared/messages";
import { hideAuthPanel, setAuthPanelError, showAuthPanel } from "./authPanel";
import { maybeShowToggleNux, resetToggleNuxForTests } from "./nux";
import { clearRichPathIntents, hasRichPathIntent } from "./richIntent";
import { ensureRichMounted, isRichMode, setRichMode } from "./richStub";
import {
  DIFF_HEADER_WRAPPER,
  FILE_VIEW_SEGMENTED,
  HEADER_ACTIONS,
  KEBAB_ICON,
  RGM_TOGGLE,
} from "./selectors";

const LABEL_TEXT = "Markdup";

const TOOLTIP_OFF =
  "Markdup is off — showing the source diff. Turn on to preview rendered markdown.";
const TOOLTIP_ON =
  "Markdup is on — showing rendered markdown. Turn off to return to the source diff.";

const pendingRegions = new Set<Element>();

/**
 * Find the kebab menu button inside a file region header.
 * @param region - The file region element.
 * @returns The kebab button element, or null if not found.
 */
function findKebabButton(region: Element): HTMLElement | null {
  const header = region.querySelector(DIFF_HEADER_WRAPPER) ?? region;
  const buttons = header.querySelectorAll<HTMLElement>("button");
  for (const button of buttons) {
    if (button.querySelector(KEBAB_ICON)) {
      return button;
    }
    const label = (
      button.getAttribute("aria-label") ??
      button.getAttribute("aria-labelledby") ??
      ""
    ).toLowerCase();
    if (label.includes("more options")) {
      return button;
    }
  }
  return null;
}

/**
 * Find the header actions container (parent of the kebab button).
 * @param region - The file region element.
 * @returns The actions container element, or null if not found.
 */
function findActionsContainer(region: Element): HTMLElement | null {
  const kebab = findKebabButton(region);
  if (kebab?.parentElement) {
    return kebab.parentElement;
  }

  const header = region.querySelector(DIFF_HEADER_WRAPPER) ?? region;
  return header.querySelector<HTMLElement>(HEADER_ACTIONS);
}

/**
 * Find GitHub native file-view segmented control in the header.
 * @param region - The file region element.
 * @returns The native toggle element, or null if not present.
 */
function findNativeFileViewToggle(region: Element): HTMLElement | null {
  const header = region.querySelector(DIFF_HEADER_WRAPPER) ?? region;
  return header.querySelector<HTMLElement>(FILE_VIEW_SEGMENTED);
}

/**
 * Hide a native file-view toggle by marking it with suppression attributes.
 * @param native - The native toggle element to hide.
 * @returns Nothing.
 */
function hideNativeFileViewToggle(native: HTMLElement): void {
  native.setAttribute("data-rgm-native-hidden", "");
  native.setAttribute("hidden", "");
  native.setAttribute("aria-hidden", "true");
}

/**
 * Update the toggle DOM to reflect the current rich/source mode.
 * @param toggle - The Markdup toggle element.
 * @param rich - True for rich mode, false for source mode.
 * @returns Nothing.
 */
function syncToggleState(toggle: HTMLElement, rich: boolean): void {
  const tip = rich ? TOOLTIP_ON : TOOLTIP_OFF;
  toggle.setAttribute("data-rgm-mode", rich ? "rich" : "source");
  toggle.setAttribute("data-tooltip", tip);

  const switchBtn = toggle.querySelector<HTMLButtonElement>('[role="switch"]');
  if (switchBtn) {
    switchBtn.setAttribute("aria-checked", String(rich));
    switchBtn.setAttribute("aria-description", tip);
  }
}

/**
 * Request the current authentication status from the background script.
 * @returns A promise that resolves with the auth status response.
 */
function sendAuthStatus(): Promise<AuthStatusResponse> {
  return chrome.runtime.sendMessage({
    type: "AUTH_STATUS",
  }) as Promise<AuthStatusResponse>;
}

/**
 * Activate rich mode for a region after successful authentication.
 * @param region - The file region element.
 * @param toggle - The Markdup toggle element.
 * @returns Nothing.
 */
function enableRich(region: Element, toggle: HTMLElement): void {
  pendingRegions.delete(region);
  hideAuthPanel(region);
  setRichMode(region, true);
  syncToggleState(toggle, true);
}

/**
 * Cancel the auth flow and revert to source mode.
 * @param region - The file region element.
 * @param toggle - The Markdup toggle element.
 * @returns Nothing.
 */
function cancelAuth(region: Element, toggle: HTMLElement): void {
  pendingRegions.delete(region);
  hideAuthPanel(region);
  void chrome.runtime.sendMessage({ type: "AUTH_CANCEL" });
  setRichMode(region, false);
  syncToggleState(toggle, false);
}

/**
 * Start the authentication flow for a file region.
 * Shows the auth panel when the user is not yet authenticated.
 * @param region - The file region element.
 * @param toggle - The Markdup toggle element.
 * @returns Nothing.
 */
function beginAuth(region: Element, toggle: HTMLElement): void {
  pendingRegions.add(region);
  syncToggleState(toggle, false);

  void sendAuthStatus()
    .then((status) => {
      if (!pendingRegions.has(region)) {
        return;
      }

      if (status.authenticated) {
        enableRich(region, toggle);
        return;
      }

      showAuthPanel(region, {
        onCancel: () => cancelAuth(region, toggle),
      });
      syncToggleState(toggle, false);
    })
    .catch((error: unknown) => {
      if (!pendingRegions.has(region)) {
        return;
      }
      const message =
        error instanceof Error ? error.message : "Markdup could not check the GitHub connection.";
      showAuthPanel(region, {
        onCancel: () => cancelAuth(region, toggle),
        errorMessage: message,
      });
      setAuthPanelError(region, message);
      syncToggleState(toggle, false);
    });
}

/**
 * Build the Markdup toggle control element for a file region.
 * @param path - The relative file path for this region.
 * @param region - The file region element.
 * @returns The toggle wrapper element.
 */
function createToggleControl(path: string, region: Element): HTMLElement {
  const toggle = document.createElement("div");
  toggle.setAttribute("data-rgm-toggle", "");
  toggle.setAttribute("data-rgm-file", path);

  const switchBtn = document.createElement("button");
  switchBtn.type = "button";
  switchBtn.setAttribute("role", "switch");
  switchBtn.setAttribute("aria-label", LABEL_TEXT);
  switchBtn.className = "rgm-switch";

  const track = document.createElement("span");
  track.className = "rgm-switch-track";
  track.setAttribute("aria-hidden", "true");

  const thumb = document.createElement("span");
  thumb.className = "rgm-switch-thumb";
  track.appendChild(thumb);
  switchBtn.appendChild(track);

  const label = document.createElement("span");
  label.className = "rgm-switch-label";
  label.textContent = LABEL_TEXT;

  toggle.appendChild(switchBtn);
  toggle.appendChild(label);

  syncToggleState(toggle, isRichMode(region) || hasRichPathIntent(path));

  /**
   * Toggle rich Markdown mode, or cancel a pending auth flow.
   * @param event - Click event from the switch or label.
   * @returns Nothing.
   */
  const onActivate = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();

    if (isRichMode(region) || pendingRegions.has(region) || hasRichPathIntent(path)) {
      cancelAuth(region, toggle);
      return;
    }

    beginAuth(region, toggle);
  };

  switchBtn.addEventListener("click", onActivate);
  label.addEventListener("click", onActivate);

  return toggle;
}

/**
 * Create a visual pipe divider for the file header.
 * @returns The divider element.
 */
function createHeaderDivider(): HTMLElement {
  const divider = document.createElement("span");
  divider.setAttribute("data-rgm-header-divider", "");
  divider.setAttribute("aria-hidden", "true");
  divider.textContent = "|";
  return divider;
}

/**
 * Place the Markdup toggle in the file header.
 * Layout: [title ...] [GitHub native controls] | [Markdup].
 * Hides GitHub native File view segmented control when present.
 * @param region - The file region element.
 * @param toggle - The Markdup toggle element.
 * @param native - The native file-view toggle, or null.
 * @returns Nothing.
 */
function placeToggle(region: Element, toggle: HTMLElement, native: HTMLElement | null): void {
  if (native) {
    hideNativeFileViewToggle(native);
  }

  const divider = createHeaderDivider();
  const actions = findActionsContainer(region);
  if (actions) {
    actions.appendChild(divider);
    actions.appendChild(toggle);
    return;
  }

  const header = region.querySelector(DIFF_HEADER_WRAPPER) ?? region;
  header.appendChild(divider);
  header.appendChild(toggle);
}

/**
 * Handle AUTH_COMPLETE and AUTH_ERROR events from the background script.
 * @param message - The extension event message.
 * @returns Nothing.
 */
function onAuthEvent(message: ExtensionEvent): void {
  if (message.type === "AUTH_COMPLETE") {
    for (const region of Array.from(pendingRegions)) {
      const toggle = region.querySelector<HTMLElement>(RGM_TOGGLE);
      if (toggle) {
        enableRich(region, toggle);
      } else {
        pendingRegions.delete(region);
      }
    }
    return;
  }

  if (message.type === "AUTH_ERROR") {
    for (const region of pendingRegions) {
      setAuthPanelError(region, message.message);
      const toggle = region.querySelector<HTMLElement>(RGM_TOGGLE);
      if (toggle) {
        syncToggleState(toggle, false);
      }
    }
  }
}

let authListenerAttached = false;

/**
 * Attach the runtime message listener for auth events (one-shot).
 * @returns Nothing.
 */
function ensureAuthListener(): void {
  if (authListenerAttached) {
    return;
  }
  if (typeof chrome === "undefined" || !chrome.runtime?.onMessage) {
    return;
  }
  authListenerAttached = true;
  chrome.runtime.onMessage.addListener((message: ExtensionEvent) => {
    if (message?.type === "AUTH_COMPLETE" || message?.type === "AUTH_ERROR") {
      onAuthEvent(message);
    }
  });
}

/**
 * Reset the one-shot runtime listener flag and clear pending state.
 * @internal Vitest helper.
 * @returns Nothing.
 */
export function resetAuthListenerForTests(): void {
  authListenerAttached = false;
  pendingRegions.clear();
  clearRichPathIntents();
  resetToggleNuxForTests();
}

/**
 * Sync a toggle element with the actual mode of its region.
 * @param region - The file region element.
 * @param toggle - The Markdup toggle element.
 * @returns Nothing.
 */
function syncToggleToActualMode(region: Element, toggle: HTMLElement): void {
  syncToggleState(toggle, isRichMode(region));
}

/**
 * Inject the Markdup switch for a markdown file region. Idempotent.
 * @param region - The file region element.
 * @param path - The relative file path for this region.
 * @returns Nothing.
 */
export function injectToggle(region: Element, path: string): void {
  ensureAuthListener();

  const existing = region.querySelector<HTMLElement>(RGM_TOGGLE);
  if (existing) {
    // GitHub can re-render the body while the toggle survives. Restore mode.
    if (hasRichPathIntent(path) || isRichMode(region)) {
      ensureRichMounted(region);
      syncToggleToActualMode(region, existing);
    }
    return;
  }

  const native = findNativeFileViewToggle(region);
  const toggle = createToggleControl(path, region);
  placeToggle(region, toggle, native);
  void maybeShowToggleNux(toggle);

  // Header re-render wiped previous toggle. Restore rich intent.
  if (hasRichPathIntent(path)) {
    ensureRichMounted(region);
    syncToggleToActualMode(region, toggle);
  }
}
