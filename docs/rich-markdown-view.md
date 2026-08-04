# Rich Markdown view

The rich view shows a Before / After render of a Markdown file on a pull request.

## What it does

1. The reviewer turns on **Rich Markdown view** for a `.md` file.
2. Markdup loads the file text at the pull request base and head through the GitHub API.
3. Markdup aligns top-level blocks into rows.
4. Markdup renders each row as formatted Markdown (not raw source).

The view is read-only. Selection and comments come in a later step.

## Data flow

```
PR URL + file path
  → FETCH_FILE_SNAPSHOT (background)
  → baseText / headText
  → alignMarkdown
  → RowModel[]
  → rich Before/After DOM
```

## Files

| Path | Role |
| --- | --- |
| `src/markdown/align.ts` | Block alignment into `RowModel` |
| `src/markdown/wordDiff.ts` | Inline insert/delete segments |
| `src/background/github/contents.ts` | Pull refs + file contents API |
| `src/content/markdownReview/richView.ts` | DOM render |
| `src/content/markdownReview/richStub.ts` | Toggle mount / unmount |

## Row rules

- Identical blocks stay on one unchanged row.
- A deleted block and the next same-type inserted block become one changed row.
- Other deletes or inserts keep an empty side with the text `not present`.
- Changed text blocks can show word-level insert and delete marks.
- Deletion marks stay on Before. Insertion marks stay on After.

## How to check

1. Connect GitHub in Settings.
2. Open a pull request Files page with a Markdown change.
3. Turn on **Rich Markdown view**.
4. Confirm Before and After show rendered Markdown with line gutters.

```bash
pnpm test
```

## Out of scope for this step

- Comment composer and GitHub review-comment writes
- Outline, change stepper, and filters
- Mermaid diagram render
- Virtualization for very long files
