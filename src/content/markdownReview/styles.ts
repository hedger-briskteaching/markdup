/**
 * Imported as a string rather than for its side effect. A plain `import
 * './markdownReview.css'` would inject on every github.com page the content
 * script matches; the review UI is only allowed on Files and Changes, so
 * init decides when to add and remove the stylesheet.
 */
import CSS from "./markdownReview.css?inline";

/** DOM id for the injected stylesheet element. */
const STYLE_ID = "rgm-markdown-review-styles";

/**
 * Insert the extension stylesheet into the document head.
 * Does nothing if the stylesheet already exists.
 * @returns Nothing.
 */
export function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

/**
 * Remove the stylesheet injected by {@link injectStyles}.
 * @returns Nothing.
 */
export function removeStyles(): void {
  document.getElementById(STYLE_ID)?.remove();
}
