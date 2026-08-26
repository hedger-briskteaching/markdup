/**
 * Render raw HTML when it contains only image elements.
 *
 * Markdown and GitHub comments are untrusted, so this deliberately creates
 * new image elements and copies only presentation attributes. Event handlers,
 * styles, classes, and other page-affecting attributes are discarded.
 * @param html - Raw HTML from a parsed Markdown block.
 * @returns A container of safe image elements, or `null` for other HTML.
 */
export function renderHtmlImages(html: string): HTMLElement | null {
  const template = document.createElement("template");
  template.innerHTML = html;

  const children = [...template.content.childNodes].filter(
    (child) => child.nodeType !== Node.TEXT_NODE || child.textContent?.trim(),
  );
  if (
    children.length === 0 ||
    children.some(
      (child) => child.nodeType !== Node.ELEMENT_NODE || (child as Element).tagName !== "IMG",
    )
  ) {
    return null;
  }

  const container = document.createElement("div");
  container.className = "rgm-rich-images";
  for (const child of children as HTMLImageElement[]) {
    const src = child.getAttribute("src");
    if (!src) return null;

    const image = document.createElement("img");
    for (const attr of ["src", "alt", "title", "width", "height"] as const) {
      const value = child.getAttribute(attr);
      if (value != null) image.setAttribute(attr, value);
    }
    container.appendChild(image);
  }
  return container;
}
