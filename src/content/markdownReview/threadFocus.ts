/**
 * Scrolling and highlighting a thread card.
 *
 * Kept free of Markdown and API imports so the navigation entry point can
 * follow a comment anchor without pulling the whole review bundle in.
 */

/**
 * Scroll to a thread card and flash it for visual attention.
 * @param richRoot - The rich view root element.
 * @param threadId - The thread id to scroll to.
 * @returns Nothing.
 */
export function scrollToThreadCard(richRoot: Element, threadId: string): void {
  const card = richRoot.querySelector<HTMLElement>(
    `[data-rgm-thread-card][data-thread-id="${threadId}"]`,
  );
  if (!card) return;

  const detail = card.querySelector<HTMLElement>(".rgm-thread-detail");
  if (detail?.hidden) {
    detail.hidden = false;
    const show = card.querySelector<HTMLButtonElement>(".rgm-thread-show");
    if (show) {
      show.textContent = "Hide";
      show.setAttribute("aria-expanded", "true");
    }
  }

  card.scrollIntoView?.({ behavior: "smooth", block: "center" });
  card.classList.add("rgm-thread-card-flash");
  window.setTimeout(() => {
    card.classList.remove("rgm-thread-card-flash");
  }, 1600);
}
