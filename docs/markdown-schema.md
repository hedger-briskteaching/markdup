# Markdown schema and transform

This module turns Markdown text into a ProseMirror document for the rich review view.

## Goal

The rich view is read-only. A reviewer can select text and add a GitHub review comment. The comment must map to the real Markdown lines. This module keeps source line numbers on each block so that mapping can work.

## Pipeline

The transform has three steps:

1. Parse the Markdown text with remark (CommonMark + GFM + YAML front matter).
2. Convert the mdast tree into a ProseMirror document.
3. Keep `srcFrom` and `srcTo` (1-based inclusive line numbers) on block nodes.

```
Markdown text → mdast (with positions) → ProseMirror doc
```

## How to use

1. Import `markdownToDoc` from `src/markdown`.
2. Pass the Markdown source string into `markdownToDoc`.
3. Read `srcFrom` and `srcTo` on block nodes when you map a selection to a comment.

You can also call `parseMarkdown` or `mdastToProseMirror` alone when you need one step.

## Schema coverage

### Block nodes

| Node | Markdown | Notes |
| --- | --- | --- |
| `paragraph` | text block | |
| `heading` | `#` … `######` | `level` is 1–6 |
| `blockquote` | `>` | |
| `horizontal_rule` | `---` / `***` | |
| `code_block` | fenced or indented | `params` holds the language tag |
| `bullet_list` / `ordered_list` | `-` / `1.` | |
| `list_item` | list entry | `checked` is `null`, `true`, or `false` for tasks |
| `table` / `table_row` / `table_header` / `table_cell` | GFM table | |
| `front_matter` | `---` YAML `---` | atom node; raw YAML in `value` |
| `html_block` | HTML block | raw HTML in `html` |

### Inline nodes and marks

| Name | Markdown |
| --- | --- |
| `text` | plain text |
| `image` | `![alt](url)` |
| `hard_break` | hard line break |
| `em` | `*emphasis*` |
| `strong` | `**strong**` |
| `code` | `` `code` `` |
| `link` | `[text](url)` or reference link |
| `strikethrough` | `~~text~~` |

`strong` and `code` can sit on the same text. Example: `**\`V2ActionMenu\`**` becomes one text node with both marks.

## Source positions

Block nodes store:

- `srcFrom` — first source line (1-based), or `null`
- `srcTo` — last source line (1-based), or `null`

These attrs are the anchor data for GitHub review comments.

## Files

| Path | Role |
| --- | --- |
| `src/markdown/schema.ts` | ProseMirror schema |
| `src/markdown/parse.ts` | Markdown → mdast |
| `src/markdown/toProseMirror.ts` | mdast → ProseMirror |
| `src/markdown/positions.ts` | Source line helpers |
| `src/markdown/index.ts` | Public API |

## Tests

```bash
pnpm test
```

The tests cover schema marks, nested marks, front matter, lists, tasks, tables, code fences, strikethrough, reference links, and HTML blocks.

## Out of scope for this module

This module does not build:

- Side-by-side diff alignment UI chrome (see `docs/rich-markdown-view.md`)
- Diff insert or delete decorations in the editor view
- Comment UI and GitHub API writes
- Mermaid diagram render
- MDX or JSX
