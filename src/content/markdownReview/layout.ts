import { getRichLayoutIntent, setRichLayoutIntent, type RichLayout } from "./richIntent";
import { getRichViewContext, repaintOverlays, setRichViewContext } from "./selection";

export type { RichLayout };

/** Apply a column layout without rebuilding the rich diff's row DOM. */
export function applyRichLayout(richRoot: HTMLElement, layout: RichLayout): void {
  clearHiddenColumnFocus(richRoot, layout);
  richRoot.setAttribute("data-rgm-layout", layout);
  const ctx = getRichViewContext(richRoot);
  if (ctx) {
    setRichViewContext(richRoot, { ...ctx, layout });
    if (ctx.path) setRichLayoutIntent(ctx.path, layout);
  }

  for (const button of richRoot.querySelectorAll<HTMLButtonElement>("[data-rgm-layout-option]")) {
    button.setAttribute(
      "aria-pressed",
      String(button.getAttribute("data-rgm-layout-option") === layout),
    );
  }

  // Let CSS apply the new column width before repainting source overlays and
  // floating comment UI. Row DOM and active editor instances remain intact.
  const reflow = () => {
    if (!richRoot.isConnected) return;
    repaintOverlays(richRoot);
    richRoot.dispatchEvent(new CustomEvent("rgm:layout-change"));
  };
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(reflow);
  } else {
    reflow();
  }
}

/** Remove focus and text selection that would otherwise become invisible. */
function clearHiddenColumnFocus(richRoot: HTMLElement, layout: RichLayout): void {
  const hiddenSide = layout === "before" ? "RIGHT" : layout === "after" ? "LEFT" : null;
  if (!hiddenSide) return;

  const active = document.activeElement;
  if (
    active instanceof HTMLElement &&
    richRoot.contains(active) &&
    active.closest(`[data-side="${hiddenSide}"]`)
  ) {
    active.blur();
  }

  const selection = window.getSelection();
  const anchor = selection?.anchorNode;
  const anchorElement = anchor instanceof Element ? anchor : anchor?.parentElement;
  if (anchorElement?.closest(`[data-side="${hiddenSide}"]`)) {
    selection?.removeAllRanges();
  }
}

/** Read the saved layout for a file that is about to mount its rich view. */
export function initialRichLayout(path: string | undefined): RichLayout {
  return getRichLayoutIntent(path);
}
