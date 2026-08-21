import type { Root } from "mdast";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

/** Unified processor configured for CommonMark + GFM + YAML front matter. */
const processor = unified().use(remarkParse).use(remarkGfm).use(remarkFrontmatter, ["yaml"]);

/**
 * Parse a Markdown string into an mdast syntax tree with source positions.
 * @param source - Raw Markdown text.
 * @returns The root mdast node.
 */
export function parseMarkdown(source: string): Root {
  return processor.parse(source) as Root;
}
