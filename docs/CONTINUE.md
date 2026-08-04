# Markdup — continuation plan

Use this file after an editor restart. Work lives in **`/Users/hedger/Documents/markdup`**, not in `review-github-markdown-extension` (that folder is almost empty).

## Status (2026-08-03)

### Done (committed on `main`)

- Chrome extension scaffold (Vite, CRXJS, React, Tailwind)
- Rich Markdown toggle on PR Files for `.md` / `.markdown`
- GitHub Device Flow auth (`repo` scope), Settings connect/disconnect
- Markdown → ProseMirror pipeline: schema, parse, transform, source line attrs  
  Commit: `bfc034a`

### Done (local, **not committed yet**)

Rich Before/After view that replaces “coming soon”:

- `alignMarkdown` / `RowModel` + word-level inline diff
- `FETCH_FILE_SNAPSHOT` (pull base/head SHAs + file contents)
- Rich DOM render (gutters, side tint, front matter, `not present`)
- Docs: `docs/rich-markdown-view.md`
- Tests: **65 passing** last run

**Before you continue coding:** commit these uncommitted files, or stash them, so you do not lose the rich view work.

```bash
cd /Users/hedger/Documents/markdup
git status
# then commit when ready
```

Branch is ahead of `origin/main` (auth commit + schema commit; rich view still dirty).

---

## Locked product rules

1. **GitHub is the only store.** Rich view is a disposable projection. No parallel comment IDs.
2. **Rich view is read-only.** Reviewer can select text and add a comment. No WYSIWYG edit of Markdown.
3. **Comments map to source line ranges** (`path`, `side`, `startLine`, `startCol`, `endLine`, `endCol`), then `POST` PR review comments.
4. **Auth:** Device Flow OAuth App “Markdup”, scope `repo`, client id in `src/shared/githubAuth.ts`.
5. **Surface:** Chrome extension on `github.com` PR Files (not a first-party GitHub UI).

---

## Architecture (current)

```
Toggle ON
  → AUTH_ENSURE (if needed)
  → FETCH_FILE_SNAPSHOT (background + token)
  → alignMarkdown(baseText, headText) → RowModel[]
  → showRichView(region, rows)
```

| Layer | Path |
| --- | --- |
| Schema / parse / PM transform | `src/markdown/` |
| Align + word diff | `src/markdown/align.ts`, `wordDiff.ts` |
| GitHub auth | `src/background/github/auth.ts` |
| File snapshot API | `src/background/github/contents.ts` |
| Messages | `src/shared/messages.ts` |
| Toggle + auth gate | `src/content/markdownReview/toggle.ts` |
| Rich mount | `src/content/markdownReview/richStub.ts` |
| Rich DOM | `src/content/markdownReview/richView.ts` |

Docs:

- `docs/markdown-schema.md` — schema and transform
- `docs/rich-markdown-view.md` — rich view behavior
- This file — what to do next

---

## Build order (remaining)

Ship in this order. Do not skip ahead to suggestions before anchors work.

| # | Slice | Goal | Notes |
| --- | --- | --- | --- |
| 0 | **Commit rich view** | Clean tree | Uncommitted work above |
| 1 | **Selection → source range** | Map DOM selection to `{side, lines, cols, quotedText}` | Use `data-block-id` + `srcFrom`/`srcTo` + segment offset map; need `srcLen` on segments if not present yet |
| 2 | **List / create review comments** | `ThreadIndex` from API; create from rich composer | Background `pulls.ts`; one store, both views |
| 3 | **Thread cards on rows** | Place open threads under After (and Before when LEFT) | Match mockups: Open / Re-anchored chips |
| 4 | **ViewFocus toggle** | Preserve scroll / thread when Source ⇄ Rich | Spec acceptance: within one row height |
| 5 | **Suggest change** | Composer tab → ` ```suggestion ` body | Refuse if patch would touch more than mapped span |
| 6 | **Outline + stepper + filter** | Nav chrome | Operate on full `RowModel[]` |
| 7 | **Re-anchor + virtualize** | New commits; long docs | Never drop threads silently |

**v1 write surface (agreed):** create comment first; suggest + resolve can follow once create round-trips.

---

## Next session — start here

1. Open `/Users/hedger/Documents/markdup`.
2. Run `pnpm test` and `pnpm type-check`.
3. Commit the rich view if still uncommitted.
4. Implement **selection → source range** (slice 1), with unit tests on fixtures.
5. Then **PR review comment list/create** (slice 2).

### Quick how to try the current rich view

1. `pnpm dev`
2. Load unpacked `dist/` in Chrome (ID `knlaahnhnocjejneaobpbbnfibfnoiei`)
3. Connect GitHub in Settings
4. Open a PR Files page with a `.md` change
5. Turn on **Rich Markdown view**

---

## Open decisions (do not re-litigate unless needed)

| Topic | Decision |
| --- | --- |
| Renderer | ProseMirror schema + DOMSerializer for display; readonly (no edit) |
| Parse | remark + GFM + front matter → mdast → PM |
| Diff grain | Block rows; word diff on text-like changed blocks |
| `.mdx` | In path detect later; fail closed if JSX breaks parse |
| Design tokens | Hex in injected CSS for now (`styles.ts`); Brisk tokens later if needed |

---

## Explicit non-goals (for now)

- WYSIWYG Markdown editor
- Mermaid live render
- Virtualization for 1000+ line files
- Fine-grained OAuth scopes (still `repo`)
- Reusing GitHub session cookies for `api.github.com`
