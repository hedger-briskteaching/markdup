/**
 * Rich-mode intent keyed by file path.
 *
 * GitHub PR Files UI can re-render a file section on collapse or expand.
 * That destroys the injected toggle, data-rgm-mode, and rich root.
 * Intent lives outside the DOM so we can restore rich mode afterward.
 */

const richPaths = new Set<string>()

/**
 * Record or clear the rich-mode intent for a file path.
 * @param path - Relative file path inside the repository.
 * @param rich - True to store intent, false to remove it.
 * @returns Nothing.
 */
export function setRichPathIntent(path: string, rich: boolean): void {
  if (rich) {
    richPaths.add(path)
  } else {
    richPaths.delete(path)
  }
}

/**
 * Determine if the user intends rich mode for a given file path.
 * @param path - Relative file path inside the repository.
 * @returns True when rich mode intent exists for this path.
 */
export function hasRichPathIntent(path: string): boolean {
  return richPaths.has(path)
}

/**
 * Remove all stored rich-mode intents.
 * @internal Vitest helper.
 * @returns Nothing.
 */
export function clearRichPathIntents(): void {
  richPaths.clear()
}
