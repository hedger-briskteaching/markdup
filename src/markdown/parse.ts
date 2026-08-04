import type { Root } from 'mdast'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkFrontmatter, ['yaml'])

/**
 * Parse Markdown text into an mdast tree with source positions.
 */
export function parseMarkdown(source: string): Root {
  return processor.parse(source) as Root
}
