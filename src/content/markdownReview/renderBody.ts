import { DOMSerializer } from "prosemirror-model";
import type { BlockView, RowModel } from "../../markdown/align";
import { markdownSchema } from "../../markdown/schema";
import type { ReviewSide } from "../../markdown/sourceRange";
import {
  buildViewSections,
  findUnchangedSectionForRow,
  type UnchangedSection,
} from "../../markdown/viewSections";
import { wordDiff, type DiffSegment } from "../../markdown/wordDiff";
import { disposeMermaidDiagrams, isMermaidBlock, renderMermaidDiagram } from "./mermaid";
import { applyRichLayout, type RichLayout } from "./layout";
import { expandUnchangedSection, getRichViewContext, toggleUnchangedSection } from "./selection";
import { findRowIdForThread, renderThreadCards } from "./threads";

const serializer = DOMSerializer.fromSchema(markdownSchema);

const TEXT_DIFF_TYPES = new Set(["paragraph", "heading", "list_item", "blockquote"]);

/**
 * Build the header and body fragment for the rich Before/After view.
 * @param rows - Aligned row models for the diff.
 * @param expandedIds - Set of unchanged section ids that are expanded.
 * @returns A DocumentFragment containing header and body elements.
 */
export function buildRichRoot(
  rows: RowModel[],
  expandedIds: ReadonlySet<string>,
  layout: RichLayout = "split",
): DocumentFragment {
  const frag = document.createDocumentFragment();

  const header = document.createElement("div");
  header.className = "rgm-rich-header";
  header.append(buildHeaderSide("before"), buildHeaderSide("after"), buildLayoutToolbar(layout));
  frag.appendChild(header);

  frag.appendChild(buildRichBody(rows, expandedIds));
  return frag;
}

/** Build one Before or After header cell. */
function buildHeaderSide(side: "before" | "after"): HTMLElement {
  const cell = document.createElement("div");
  cell.className = "rgm-rich-header-side";
  cell.setAttribute("data-side", side === "before" ? "LEFT" : "RIGHT");
  cell.setAttribute("aria-label", side === "before" ? "Before" : "After");
  cell.textContent = side === "before" ? "Before" : "After";
  return cell;
}

/** Build the in-place column-layout selector shown above the diff columns. */
function buildLayoutToolbar(layout: RichLayout): HTMLElement {
  const toolbar = document.createElement("div");
  toolbar.className = "rgm-rich-layout-toolbar";
  toolbar.setAttribute("role", "group");
  toolbar.setAttribute("aria-label", "Diff layout");
  toolbar.setAttribute("data-rgm-chrome", "");

  const options: Array<{
    layout: RichLayout;
    label: string;
    tooltip: string;
  }> = [
    {
      layout: "before",
      label: "Before",
      tooltip: "Show only the original version",
    },
    {
      layout: "after",
      label: "After",
      tooltip: "Show only the updated version",
    },
    {
      layout: "split",
      label: "All",
      tooltip: "Show the original and updated versions side by side",
    },
  ];

  for (const option of options) {
    const selected = option.layout === layout;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "rgm-rich-layout-btn";
    button.textContent = option.label;
    button.setAttribute("data-tooltip", option.tooltip);
    button.setAttribute("aria-label", option.tooltip);
    button.setAttribute("data-rgm-layout-option", option.layout);
    button.setAttribute("aria-pressed", String(selected));

    // A mouse switch should not collapse selected source text or an active
    // editor selection. Keyboard activation keeps normal button focus.
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", () => {
      const richRoot = button.closest<HTMLElement>("[data-rgm-rich]");
      if (richRoot) applyRichLayout(richRoot, option.layout);
    });
    toolbar.appendChild(button);
  }
  return toolbar;
}

/**
 * Build the body element with rows grouped into sections.
 * Changed rows always render. Consecutive unchanged rows render
 * behind a fold bar (collapsed unless expanded).
 * @param rows - Aligned row models for the diff.
 * @param expandedIds - Set of unchanged section ids that are expanded.
 * @returns The body element containing all row and fold elements.
 */
export function buildRichBody(rows: RowModel[], expandedIds: ReadonlySet<string>): HTMLElement {
  const body = document.createElement("div");
  body.className = "rgm-rich-body";
  body.setAttribute("role", "table");

  body.setAttribute("aria-label", "Rich markdown diff");

  for (const section of buildViewSections(rows)) {
    if (section.kind === "changed") {
      for (const row of section.rows) {
        body.appendChild(buildRow(row));
      }
      continue;
    }

    const expanded = expandedIds.has(section.id);
    body.appendChild(buildFoldBar(section, expanded));
    if (expanded) {
      for (const row of section.rows) {
        body.appendChild(buildRow(row));
      }
    }
  }

  return body;
}

/**
 * Rebuild the rich body from context state and re-place thread cards.
 * Keeps the header, composer, bubble, and highlight layer.
 * @param richRoot - The rich view root element.
 * @returns Nothing.
 */
export function renderRichBody(richRoot: Element): void {
  const ctx = getRichViewContext(richRoot);
  if (!ctx) return;
  const expanded = ctx.expandedUnchangedIds ?? new Set<string>();
  const fresh = buildRichBody(ctx.rows, expanded);
  const old = richRoot.querySelector(".rgm-rich-body");
  if (old) {
    disposeMermaidDiagrams(old);
    old.replaceWith(fresh);
  } else {
    richRoot.appendChild(fresh);
  }
  renderThreadCards(richRoot);
}

/**
 * Expand every collapsed unchanged section that owns a thread row.
 * Call this before renderRichBody so comments are never hidden behind a fold.
 * @param richRoot - The rich view root element.
 * @returns Nothing.
 */
export function expandSectionsForThreads(richRoot: Element): void {
  const ctx = getRichViewContext(richRoot);
  const threads = ctx?.threads ?? [];
  if (!ctx || threads.length === 0) return;

  const sections = buildViewSections(ctx.rows);
  for (const thread of threads) {
    const rowId = findRowIdForThread(ctx.rows, thread);
    if (!rowId) continue;
    const section = findUnchangedSectionForRow(sections, rowId);
    if (section) {
      expandUnchangedSection(richRoot, section.id);
    }
  }
}

/**
 * Build a collapsible fold bar for an unchanged section.
 * @param section - The unchanged section descriptor.
 * @param expanded - True when this section is currently expanded.
 * @returns The fold bar element.
 */
function buildFoldBar(section: UnchangedSection, expanded: boolean): HTMLElement {
  const bar = document.createElement("div");
  bar.className = "rgm-rich-fold";
  bar.setAttribute("data-rgm-fold", "");
  bar.setAttribute("data-section-id", section.id);
  bar.setAttribute("data-rgm-chrome", "");
  bar.setAttribute("role", "row");

  const count = section.rows.length;
  const label = `${count} unchanged ${count === 1 ? "block" : "blocks"}`;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "rgm-rich-fold-btn";
  btn.setAttribute("data-rgm-fold-toggle", "");
  btn.setAttribute("aria-expanded", String(expanded));
  btn.setAttribute("aria-label", `${expanded ? "Collapse" : "Expand"} ${label}`);

  const icon = document.createElement("span");
  icon.className = "rgm-rich-fold-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = expanded ? "−" : "+";

  const text = document.createElement("span");
  text.className = "rgm-rich-fold-label";
  text.textContent = label;

  btn.append(icon, text);

  if (section.lineFrom != null && section.lineTo != null) {
    const lines = document.createElement("span");
    lines.className = "rgm-rich-fold-lines";
    lines.textContent =
      section.lineFrom === section.lineTo
        ? `L${section.lineFrom}`
        : `L${section.lineFrom}–L${section.lineTo}`;
    btn.append(lines);
  }

  btn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const richRoot = bar.closest("[data-rgm-rich]");
    if (!richRoot) return;
    toggleUnchangedSection(richRoot, section.id);
    renderRichBody(richRoot);
  });

  bar.appendChild(btn);
  return bar;
}

/**
 * Build a single diff row with Before and After cells.
 * @param row - The row model to render.
 * @returns The row element.
 */
export function buildRow(row: RowModel): HTMLElement {
  const el = document.createElement("div");
  el.className = "rgm-rich-row";
  el.setAttribute("data-row-id", row.id);
  el.setAttribute("data-changed", row.changed ? "true" : "false");
  el.setAttribute("role", "row");

  el.appendChild(
    buildCell({
      side: "before",
      block: row.old,
      peer: row.new,
      changed: row.changed,
      rowId: row.id,
    }),
  );
  el.appendChild(
    buildCell({
      side: "after",
      block: row.new,
      peer: row.old,
      changed: row.changed,
      rowId: row.id,
    }),
  );

  return el;
}

/**
 * Build a single cell (Before or After) for a diff row.
 * @param args - Cell configuration with side, block, peer, and metadata.
 * @returns The cell element.
 */
function buildCell(args: {
  side: "before" | "after";
  block?: BlockView;
  peer?: BlockView;
  changed: boolean;
  rowId: string;
}): HTMLElement {
  const { side, block, peer, changed, rowId } = args;
  const reviewSide: ReviewSide = side === "before" ? "LEFT" : "RIGHT";
  const cell = document.createElement("div");
  cell.className = `rgm-rich-cell rgm-rich-cell-${side}`;
  cell.setAttribute("role", "cell");
  cell.setAttribute("data-block-id", `${rowId}::${side}`);
  cell.setAttribute("data-side", reviewSide);

  if (changed && block) {
    cell.classList.add(side === "before" ? "rgm-rich-cell-del" : "rgm-rich-cell-add");
  }

  if (!block) {
    cell.classList.add("rgm-rich-cell-missing");
    const missing = document.createElement("p");
    missing.className = "rgm-rich-missing";
    missing.textContent = "not present";
    cell.appendChild(missing);
    return cell;
  }

  if (block.srcFrom != null) {
    cell.setAttribute("data-src-from", String(block.srcFrom));
  }
  if (block.srcTo != null) {
    cell.setAttribute("data-src-to", String(block.srcTo));
  }

  cell.appendChild(buildGutter(block));
  cell.appendChild(buildBlockContent(block, side, peer, changed));
  return cell;
}

/**
 * Build the line-number gutter for a cell.
 * @param block - The block view containing source line information.
 * @returns The gutter element.
 */
function buildGutter(block: BlockView): HTMLElement {
  const gutter = document.createElement("div");
  gutter.className = "rgm-rich-gutter";
  gutter.setAttribute("aria-hidden", "true");
  gutter.setAttribute("data-rgm-chrome", "");

  const from = document.createElement("span");
  from.className = "rgm-rich-gutter-line";
  from.textContent = block.srcFrom != null ? String(block.srcFrom) : "";

  const rule = document.createElement("span");
  rule.className = "rgm-rich-gutter-rule";

  const to = document.createElement("span");
  to.className = "rgm-rich-gutter-line";
  const showTo = block.srcTo != null && block.srcFrom != null && block.srcTo !== block.srcFrom;
  to.textContent = showTo ? String(block.srcTo) : "";

  gutter.appendChild(from);
  gutter.appendChild(rule);
  gutter.appendChild(to);
  return gutter;
}

/**
 * Build the content area for a block, with optional word-level diff markup.
 * @param block - The block view to render.
 * @param side - Which side this cell belongs to (before or after).
 * @param peer - The peer block on the opposite side.
 * @param changed - True when this row has changes.
 * @returns The content wrapper element.
 */
function buildBlockContent(
  block: BlockView,
  side: "before" | "after",
  peer: BlockView | undefined,
  changed: boolean,
): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "rgm-rich-content";

  if (block.type === "front_matter") {
    wrap.appendChild(renderFrontMatter(block));
    return wrap;
  }

  if (isMermaidBlock(block.node)) {
    wrap.appendChild(renderMermaidDiagram(block.node.textContent));
    return wrap;
  }

  if (changed && peer && TEXT_DIFF_TYPES.has(block.type) && block.type === peer.type) {
    const oldText = side === "before" ? block.node.textContent : peer.node.textContent;
    const newText = side === "before" ? peer.node.textContent : block.node.textContent;
    const { oldSegments, newSegments } = wordDiff(oldText, newText);
    const segments = side === "before" ? oldSegments : newSegments;
    if (segments.some((s) => s.tone)) {
      wrap.appendChild(renderSegmentedBlock(block, segments, side));
      return wrap;
    }
  }

  const dom = serializer.serializeNode(block.node);
  if (dom instanceof HTMLElement) {
    enhanceSerialized(dom, block);
    wrap.appendChild(dom);
  } else {
    wrap.appendChild(dom);
  }
  return wrap;
}

/**
 * Render a block with inline word-diff segments (ins/del spans).
 * @param block - The block view to render.
 * @param segments - Word-diff segments for this side.
 * @param side - Which side this cell belongs to.
 * @returns The rendered block element with diff markup.
 */
function renderSegmentedBlock(
  block: BlockView,
  segments: DiffSegment[],
  side: "before" | "after",
): HTMLElement {
  const tag = block.type === "heading" ? `h${(block.node.attrs.level as number) || 1}` : "p";
  const el = document.createElement(tag);
  el.className = `rgm-rich-block rgm-rich-block-${block.type}`;

  if (block.type === "list_item") {
    const item = document.createElement("div");
    item.className = "rgm-rich-list-item";
    const bullet = document.createElement("span");
    bullet.className = "rgm-rich-bullet";
    bullet.setAttribute("data-rgm-chrome", "");
    bullet.textContent = "•";
    item.appendChild(bullet);
    const text = document.createElement("span");
    appendSegments(text, segments, side);
    item.appendChild(text);
    return item;
  }

  appendSegments(el, segments, side);
  return el;
}

/**
 * Append diff segments as child spans to a parent element.
 * @param parent - The element to append segment spans into.
 * @param segments - Word-diff segments to render.
 * @param side - Which side this cell belongs to.
 * @returns Nothing.
 */
function appendSegments(
  parent: HTMLElement,
  segments: DiffSegment[],
  side: "before" | "after",
): void {
  let srcOffset = 0;
  for (const seg of segments) {
    if (side === "before" && seg.tone === "ins") continue;
    if (side === "after" && seg.tone === "del") continue;

    const host = document.createElement("span");
    host.setAttribute("data-src-offset", String(srcOffset));
    host.setAttribute("data-src-len", String(seg.srcLen));
    if (seg.tone) {
      host.className = seg.tone === "ins" ? "rgm-rich-ins" : "rgm-rich-del";
    }
    host.textContent = seg.text;
    parent.appendChild(host);
    srcOffset += seg.srcLen;
  }
}

/**
 * Render a front-matter block as a labeled card.
 * @param block - The block view containing front-matter content.
 * @returns The front-matter card element.
 */
function renderFrontMatter(block: BlockView): HTMLElement {
  const card = document.createElement("div");
  card.className = "rgm-rich-front-matter";
  const label = document.createElement("div");
  label.className = "rgm-rich-front-matter-label";
  label.setAttribute("data-rgm-chrome", "");
  label.textContent = "Front matter";
  card.appendChild(label);

  const pre = document.createElement("pre");
  pre.className = "rgm-rich-front-matter-body";
  const value = String(block.node.attrs.value ?? "");
  const wrap = document.createElement("span");
  wrap.setAttribute("data-src-offset", "0");
  wrap.setAttribute("data-src-len", String(value.length));
  wrap.textContent = value;
  pre.appendChild(wrap);
  card.appendChild(pre);
  return card;
}

/**
 * Add language chip and plain-text offset annotations to a serialized block.
 * @param dom - The serialized DOM element.
 * @param block - The block view with metadata.
 * @returns Nothing.
 */
function enhanceSerialized(dom: HTMLElement, block: BlockView): void {
  if (block.type === "code_block") {
    const lang = String(block.node.attrs.params ?? "");
    if (lang) {
      dom.setAttribute("data-lang", lang);
      const chip = document.createElement("span");
      chip.className = "rgm-rich-code-lang";
      chip.setAttribute("data-rgm-chrome", "");
      chip.textContent = lang;
      dom.prepend(chip);
    }
  }
  annotatePlainTextOffsets(dom);
}

/**
 * Wrap contiguous text under a serialized block with offset map entries.
 * This lets selection resolve without walking chrome elements.
 * @param root - The serialized block element.
 * @returns Nothing.
 */
function annotatePlainTextOffsets(root: HTMLElement): void {
  let offset = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    if (
      current.nodeType === Node.TEXT_NODE &&
      !current.parentElement?.closest("[data-rgm-chrome]")
    ) {
      texts.push(current as Text);
    }
    current = walker.nextNode();
  }
  for (const textNode of texts) {
    const len = textNode.textContent?.length ?? 0;
    if (len === 0) continue;
    const wrap = document.createElement("span");
    wrap.setAttribute("data-src-offset", String(offset));
    wrap.setAttribute("data-src-len", String(len));
    textNode.parentNode?.insertBefore(wrap, textNode);
    wrap.appendChild(textNode);
    offset += len;
  }
}
