/**
 * Rich-mode intent keyed by file path.
 *
 * GitHub's PR Files UI may re-render a file section when collapsing /
 * expanding (destroying our injected toggle, `data-rgm-mode`, and rich
 * root). Intent lives outside that DOM so we can restore rich mode.
 */

const richPaths = new Set<string>()

export function setRichPathIntent(path: string, rich: boolean): void {
  if (rich) {
    richPaths.add(path)
  } else {
    richPaths.delete(path)
  }
}

export function hasRichPathIntent(path: string): boolean {
  return richPaths.has(path)
}

/** @internal Vitest helper */
export function clearRichPathIntents(): void {
  richPaths.clear()
}
