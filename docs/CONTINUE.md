# Markdup — continuation plan

Use this file after an editor restart. Work lives in **`/Users/hedger/Documents/markdup`**, not in `review-github-markdown-extension` (that folder is almost empty).

## Status (2026-08-03)

### Done (committed on `main`)

- Chrome extension scaffold (Vite, CRXJS, React, Tailwind)
- Rich Markdown toggle on PR Files for `.md` / `.markdown`
- GitHub Device Flow auth (`repo` scope), Settings connect/disconnect
- Markdown → ProseMirror pipeline: schema, parse, transform, source line attrs  
  Commit: `bfc034a`
- Rich Before/After view (align, word diff, file snapshot, DOM)  
  Commit: `336ad01`

### Done (local, **not committed yet**)

**Slice 1 — Selection → source range**

- `src/markdown/sourceRange.ts` — plain offset → line/col, `SourceRange`
- `src/content/markdownReview/selection.ts` — DOM selection → `SourceRange`
- Diff segments carry `srcLen`; rich DOM has `data-src-offset` / `data-side` / `data-src-from`

**Slice 2 — List / create review comments**

- `src/background/github/pulls.ts` — list comments, `buildThreads`, create comment
- Messages: `FETCH_THREAD_INDEX`, `CREATE_REVIEW_COMMENT`
- Rich composer on text selection → posts review comment
- Thread index loaded into rich context (cards come in slice 3)

Tests: **85 passing** last run

**Before you continue coding:** commit these uncommitted files.

```bash
cd /Users/hedger/Documents/markdup
git status
# then commit when ready
```

---

## Locked product rules

1. **GitHub is the only store.** Rich view is a disposable projection. No parallel comment IDs.
2. **Rich view is read-only.** Reviewer can select text and add a comment. No WYSIWYG edit of Markdown.
3. **Comments map to source line ranges** (`path`, `side`, `startLine`, `startCol`, `endLine`, `endCol`), then `POST` PR review comments.
4. **Auth:** Both OAuth Device Flow and PAT paste are supported. OAuth App “Markdup”, scope `repo`, client id in `src/shared/githubAuth.ts`. Use PAT when an org blocks the OAuth App.
5. **Surface:** Chrome extension on `github.com` PR Files (not a first-party GitHub UI).

---

## Architecture (current)

```
Toggle ON
  → AUTH_ENSURE (if needed)
  → FETCH_FILE_SNAPSHOT (background + token)
  → alignMarkdown(baseText, headText) → RowModel[]
  → showRichView(region, rows)
  → FETCH_THREAD_INDEX (stashed on context)
  → selection → SourceRange → composer → CREATE_REVIEW_COMMENT
```

| Layer | Path |
| --- | --- |
| Schema / parse / PM transform | `src/markdown/` |
| Align + word diff | `src/markdown/align.ts`, `wordDiff.ts` |
| Source range mapping | `src/markdown/sourceRange.ts` |
| DOM selection → range | `src/content/markdownReview/selection.ts` |
| Composer | `src/content/markdownReview/composer.ts` |
| GitHub auth | `src/background/github/auth.ts` |
| File snapshot API | `src/background/github/contents.ts` |
| Review comments API | `src/background/github/pulls.ts` |
| Messages | `src/shared/messages.ts` |
| Toggle + auth gate | `src/content/markdownReview/toggle.ts` |
| Rich mount | `src/content/markdownReview/richStub.ts` |
| Rich DOM | `src/content/markdownReview/richView.ts` |

Docs:

- `docs/markdown-schema.md` — schema and transform
- `docs/rich-markdown-view.md` — rich view + selection mapping
- This file — what to do next

---

## Build order (remaining)

Ship in this order. Do not skip ahead to suggestions before anchors work.

| # | Slice | Goal | Notes |
| --- | --- | --- | --- |
| 0 | **Commit rich view** | Clean tree | Done (`336ad01`) |
| 1 | **Selection → source range** | Map DOM selection to `{side, lines, cols, quotedText}` | Done locally |
| 2 | **List / create review comments** | `ThreadIndex` from API; create from rich composer | Done locally — commit next |
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
3. Commit slices 1–2 if still uncommitted.
4. Implement **thread cards on rows** (slice 3).
5. Then **ViewFocus toggle** (slice 4).

### Quick how to try

1. `pnpm dev`
2. Load unpacked `dist/` in Chrome (ID `knlaahnhnocjejneaobpbbnfibfnoiei`)
3. Connect GitHub in Settings
4. Open a PR Files page with a `.md` change
5. Turn on **Rich Markdown view**
6. Select text → composer → **Comment** (posts a GitHub review comment)

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
