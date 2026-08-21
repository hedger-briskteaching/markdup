# Rich Markdown view

The rich view shows a Before / After render of a Markdown file on a pull request.
Use the compact **Diff layout** control above the columns to show **Before**,
**After**, or **Before | After**. Switching layout keeps both columns mounted,
so rendered content, expanded sections, and in-progress comment drafts remain
available when the hidden column is shown again.

## What it does

1. The reviewer turns on **Markdup** for a `.md` file.
2. Markdup loads the file text at the pull request base and head through the GitHub API.
3. Markdup aligns top-level blocks into rows.
4. Markdup renders each row as formatted Markdown (not raw source).

The view is read-only. Selection maps to a source line range for comments.

## Mermaid diagrams

Fenced blocks marked `mermaid` render in a local, sandboxed extension iframe.
The frame bundles Mermaid and supports drag-to-pan, zoom controls, and reset.
After Mermaid reports its SVG dimensions, Markdup sets the frame height so the
diagram starts at 90% of the available frame width while retaining its aspect
ratio. The **Diagram source** disclosure keeps the original text selectable
for line comments and provides a fallback when a diagram cannot render.

## Collapsed unchanged sections

1. Rows are grouped into sections by `buildViewSections` (`src/markdown/viewSections.ts`):
   consecutive unchanged rows form an **unchanged section**, everything else a changed one.
2. Unchanged sections start **collapsed** behind a `+` fold bar showing the
   block count and source line span (`L12–L48`). Clicking toggles expand / collapse.
3. Expanded ids live on `RichViewContext.expandedUnchangedIds`; toggling
   rebuilds the body via `renderRichBody` (`src/content/markdownReview/renderBody.ts`).
4. When threads sync from GitHub, sections that own a thread's row are
   auto-expanded so comments never hide behind a fold. Cards for rows the
   user re-collapsed are skipped, not dumped at the bottom.

## GitHub header controls while rich mode is on

Header layout:

`> path …  [GitHub native controls] | [Markdup switch]`

GitHub's native File view segmented control is hidden. Markdup sits after
Viewed / Comment / more-options, separated by a `|`.

While **Markdup** is on, Markdup hides native controls that would
fight the rich surface:

- file-section collapse / expand chevron
- **Viewed** checkbox
- **Comment on this file**

They are restored when rich mode turns off.
(`src/content/markdownReview/headerControls.ts`)

If GitHub re-renders the file section and wipes injected DOM while rich intent
is still on, Markdup restores the toggle and remounts from `richIntent.ts`.

## Thread ↔ text interactions

1. Commented text carries a persistent attention-tinted mark (overlay boxes
   with the thread id; cell tint fallback without layout APIs).
2. Clicking marked text scrolls to its thread card, expands it if hidden,
   and flashes an outline. Clicks with an active selection are ignored.
3. Hovering or focusing a thread card highlights the exact text it targets;
   leaving clears the highlight.

## Comment threads (create / reply / edit / delete)

1. Thread cards render **every** comment in `comments[]` as read-only Markdown
   (same schema + DOMSerializer as the rich view).
2. Create / reply / edit use a shared **ProseMirror CommentEditor** (WYSIWYG).
   On submit the editor serializes to markdown via `docToMarkdown`. There is
   no separate Write/Preview mode.
3. Reply / Edit / Delete call GitHub (`REPLY_REVIEW_COMMENT`,
   `UPDATE_REVIEW_COMMENT`, `DELETE_REVIEW_COMMENT`), then
   `syncThreadsFromServer` (full replace). Edit/Delete only appear on comments
   authored by the signed-in user (`viewerLogin` on rich context).
4. The reviewed PR Markdown file stays read-only — WYSIWYG is comment-only.

## Selection → source range

1. Each rich cell has `data-block-id`, `data-side` (`LEFT` / `RIGHT`), and `data-src-from` / `data-src-to`.
2. Text chunks carry `data-src-offset` and `data-src-len` (word-diff segments use `srcLen`).
3. `selectionToSourceRange` maps the DOM selection onto **source-view line
   numbers** (soft-wrapped paragraphs included) and expands to whole lines.
   It does **not** jump the live selection to distant diff hunks.
4. The live selection is expanded to those whole lines and painted with a
   persistent highlight. GitHub’s “must be in the PR diff” rule is enforced
   when posting, not by hijacking the selection.

| Path                                      | Role                                              |
| ----------------------------------------- | ------------------------------------------------- |
| `src/markdown/sourceRange.ts`             | Plain offset → source line/col; whole-line expand |
| `src/shared/commentableLines.ts`          | Parse patch; clamp to commentable lines on create |
| `src/content/markdownReview/selection.ts` | DOM selection → `SourceRange` + highlight         |

Chrome UI (`data-rgm-chrome`) is skipped when measuring offsets.

## Review comments

1. On rich mount, Markdup loads `FETCH_THREAD_INDEX` for the file (stashed for thread cards).
2. Selecting text opens a composer under the row.
3. **Comment** adds a line comment to your **pending review** via GraphQL
   (`addPullRequestReviewThread`) — REST cannot append to a pending draft.
   Starts a pending review if needed. You can stack many pending comments,
   then submit on GitHub. After create, Markdup **syncs** from GitHub via
   GraphQL `reviewThreads` (REST drops line/side on pending GraphQL comments)
   and only then paints thread cards — full replace. Switching back to source
   reloads the page so native widgets match production.

| Path                                     | Role                           |
| ---------------------------------------- | ------------------------------ |
| `src/background/github/pulls.ts`         | List / create + `buildThreads` |
| `src/content/markdownReview/composer.ts` | Selection composer UI          |
| `src/shared/reviewComment.ts`            | Create payload helper          |

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

| Path                                       | Role                                         |
| ------------------------------------------ | -------------------------------------------- |
| `src/markdown/align.ts`                    | Block alignment into `RowModel`              |
| `src/markdown/wordDiff.ts`                 | Inline insert/delete segments                |
| `src/markdown/sourceRange.ts`              | Source line/col helpers                      |
| `src/background/github/contents.ts`        | Pull refs + file contents API                |
| `src/markdown/viewSections.ts`             | Group rows into changed / unchanged sections |
| `src/content/markdownReview/richView.ts`   | Mount / unmount, loading and error states    |
| `src/content/markdownReview/renderBody.ts` | Row + fold-bar DOM, body rebuild             |
| `src/content/markdownReview/richStub.ts`   | Toggle mount / unmount                       |
| `src/content/markdownReview/selection.ts`  | Selection → source range + expand state      |

## Row rules

- Identical blocks stay on one unchanged row.
- A deleted block and the next same-type inserted block become one changed row.
- Other deletes or inserts keep an empty side with the text `not present`.
- Changed text blocks can show word-level insert and delete marks.
- Deletion marks stay on Before. Insertion marks stay on After.

## How to check

1. Connect GitHub in Settings.
2. Open a pull request Files page with a Markdown change.
3. Turn on **Markdup**.
4. Confirm Before and After show rendered Markdown with line gutters.

```bash
pnpm test
```

## Out of scope for this step

- Thread cards under rows (next slice)
- Outline, change stepper, and filters
- Mermaid diagram render
- Virtualization for very long files
