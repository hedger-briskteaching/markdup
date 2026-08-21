/**
 * Rich-mode intent keyed by file path.
 *
 * GitHub PR Files UI can re-render a file section on collapse or expand.
 * That destroys the injected toggle, data-rgm-mode, and rich root.
 * Intent lives outside the DOM so we can restore rich mode afterward.
 */

const richPaths = new Set<string>();

export type RichLayout = "before" | "after" | "split";

const layoutsByPath = new Map<string, RichLayout>();

/**
 * Record or clear the rich-mode intent for a file path.
 * @param path - Relative file path inside the repository.
 * @param rich - True to store intent, false to remove it.
 * @returns Nothing.
 */
export function setRichPathIntent(path: string, rich: boolean): void {
  if (rich) {
    richPaths.add(path);
  } else {
    richPaths.delete(path);
    layoutsByPath.delete(path);
  }
}

/** Store the preferred rich-diff layout for one file while rich mode is on. */
export function setRichLayoutIntent(path: string, layout: RichLayout): void {
  layoutsByPath.set(path, layout);
}

/** Return the file's selected layout, defaulting to the full Before/After view. */
export function getRichLayoutIntent(path: string | undefined): RichLayout {
  return path ? (layoutsByPath.get(path) ?? "split") : "split";
}

/**
 * Determine if the user intends rich mode for a given file path.
 * @param path - Relative file path inside the repository.
 * @returns True when rich mode intent exists for this path.
 */
export function hasRichPathIntent(path: string): boolean {
  return richPaths.has(path);
}

/**
 * Remove all stored rich-mode intents.
 * @internal Vitest helper.
 * @returns Nothing.
 */
export function clearRichPathIntents(): void {
  richPaths.clear();
  layoutsByPath.clear();
}
