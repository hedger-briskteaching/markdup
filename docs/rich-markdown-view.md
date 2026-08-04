# Rich Markdown view

The rich view shows a Before / After render of a Markdown file on a pull request.

## What it does

1. The reviewer turns on **Rich Markdown view** for a `.md` file.
2. Markdup loads the file text at the pull request base and head through the GitHub API.
3. Markdup aligns top-level blocks into rows.
4. Markdup renders each row as formatted Markdown (not raw source).

The view is read-only. Selection maps to a source line range for comments.

## Selection → source range

1. Each rich cell has `data-block-id`, `data-side` (`LEFT` / `RIGHT`), and `data-src-from` / `data-src-to`.
2. Text chunks carry `data-src-offset` and `data-src-len` (word-diff segments use `srcLen`).
3. `selectionToSourceRange` reads the DOM selection and returns `{ side, startLine, startCol, endLine, endCol, quotedText }`.

| Path | Role |
| --- | --- |
| `src/markdown/sourceRange.ts` | Plain offset → line/col |
| `src/content/markdownReview/selection.ts` | DOM selection → `SourceRange` |

Chrome UI (`data-rgm-chrome`) is skipped when measuring offsets.

## Review comments

1. On rich mount, Markdup loads `FETCH_THREAD_INDEX` for the file (stashed for thread cards).
2. Selecting text opens a composer under the row.
3. **Comment** sends `CREATE_REVIEW_COMMENT` with `side`, `line`, and optional `start_line`.

| Path | Role |
| --- | --- |
| `src/background/github/pulls.ts` | List / create + `buildThreads` |
| `src/content/markdownReview/composer.ts` | Selection composer UI |
| `src/shared/reviewComment.ts` | Create payload helper |

## Data flow

```
PR URL + file path
  → FETCH_FILE_SNAPSHOT (background)
  → baseText / headText
  → alignMarkdown
  → RowModel[]
  → rich Before/After DOM
  → selection → SourceRange
```

## Files

| Path | Role |
| --- | --- |
| `src/markdown/align.ts` | Block alignment into `RowModel` |
| `src/markdown/wordDiff.ts` | Inline insert/delete segments |
| `src/markdown/sourceRange.ts` | Source line/col helpers |
| `src/background/github/contents.ts` | Pull refs + file contents API |
| `src/content/markdownReview/richView.ts` | DOM render |
| `src/content/markdownReview/richStub.ts` | Toggle mount / unmount |
| `src/content/markdownReview/selection.ts` | Selection → source range |

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

- Thread cards under rows (next slice)
- Outline, change stepper, and filters
- Mermaid diagram render
- Virtualization for very long files
