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
- Selection → source range; review comment list/create + composer; PAT auth fallback  
  Commit: `bca77f0`
- Comment selection bubble + thread cards (Open / Re-anchored)
- GraphQL thread sync (full replace, post-create polling) + page reload on rich → source after posts
- Collapsible unchanged sections: `buildViewSections`, +/- fold bars, auto-expand for synced threads — local pending commit

### Auth notes

- **Option 1:** OAuth Device Flow (try first)
- **Option 2:** Personal access token paste in Settings (fallback when an org blocks the OAuth App)
- Local PAT backup may live in gitignored `.env` as `MARKDUP_GITHUB_PAT` — the extension does **not** read `.env`; paste into Settings

Tests: **129 passing** last run

---

## Locked product rules

1. **GitHub is the only store.** Rich view is a disposable projection. No parallel comment IDs.
2. **Client threads always match production.** After mount or create, replace local thread state from `FETCH_THREAD_INDEX` (GraphQL `reviewThreads` — REST omits line/side for pending drafts). Full replace only. Post-create polls until the new comment id appears, or surfaces a sync error.
3. **Rich view is read-only.** Reviewer can select text and add a comment. No WYSIWYG edit of Markdown.
4. **Comments map to source line ranges** (`path`, `side`, `startLine`, `startCol`, `endLine`, `endCol`), then create PR review comments on GitHub.
5. **Auth:** Both OAuth Device Flow and PAT paste are supported. OAuth App “Markdup”, scope `repo`, client id in `src/shared/githubAuth.ts`. Use PAT when an org blocks the OAuth App.
6. **Surface:** Chrome extension on `github.com` PR Files (not a first-party GitHub UI).
7. **Native view after posts:** Switching off rich mode reloads the page when comments were posted so GitHub’s Files widgets match production.
8. **Unchanged sections start collapsed** behind +/- fold bars; sections owning synced threads auto-expand so comments never hide.
---

## Architecture (current)

```
Toggle ON
  → AUTH_ENSURE / existing PAT (if needed)
  → FETCH_FILE_SNAPSHOT (background + token)
  → alignMarkdown(baseText, headText) → RowModel[]
  → showRichView(region, rows)
  → FETCH_THREAD_INDEX (stashed on context; not rendered yet)
  → selection → SourceRange → composer → CREATE_REVIEW_COMMENT
```

| Layer | Path |
| --- | --- |
| Schema / parse / PM transform | `src/markdown/` |
| Align + word diff | `src/markdown/align.ts`, `wordDiff.ts` |
| Source range mapping | `src/markdown/sourceRange.ts` |
| DOM selection → range | `src/content/markdownReview/selection.ts` |
| Composer | `src/content/markdownReview/composer.ts` |
| GitHub auth (OAuth + PAT) | `src/background/github/auth.ts`, `src/options/App.tsx` |
| File snapshot API | `src/background/github/contents.ts` |
| Review comments API | `src/background/github/pulls.ts` |
| Messages | `src/shared/messages.ts` |
| Toggle + auth gate | `src/content/markdownReview/toggle.ts` |
| Rich mount | `src/content/markdownReview/richStub.ts` |
| Rich mount/unmount + states | `src/content/markdownReview/richView.ts` |
| Row + fold-bar DOM | `src/content/markdownReview/renderBody.ts` |
| Section grouping | `src/markdown/viewSections.ts` |
| Thread sync (GraphQL, full replace) | `src/content/markdownReview/syncThreads.ts` |

Docs:

- `docs/markdown-schema.md` — schema and transform
- `docs/rich-markdown-view.md` — rich view + selection mapping
- This file — what to do next

---

## Build order (remaining)

Ship in this order.

| # | Slice | Goal | Notes |
| --- | --- | --- | --- |
| 0 | **Commit rich view** | Clean tree | Done (`336ad01`) |
| 1 | **Selection → source range** | Map DOM selection to `{side, lines, cols, quotedText}` | Done (`bca77f0`) |
| 2 | **List / create review comments** | `ThreadIndex` from API; create from rich composer | Done (`bca77f0`) |
| 3 | **Thread cards on rows** | Place open threads under After (and Before when LEFT) | Done — Open / Re-anchored chips + Show |
| 4 | **ViewFocus toggle** | Preserve scroll / thread when Source ⇄ Rich | Spec acceptance: within one row height |
| 5 | **Outline + stepper + filter** | Nav chrome | Operate on full `RowModel[]` |
| 6 | **Re-anchor + virtualize** | New commits; long docs | Never drop threads silently |

**v1 write surface:** create review comments only (no suggest-change).

---

## Next session — start here

1. Open `/Users/hedger/Documents/markdup`.
2. Run `pnpm test` and `pnpm type-check`.
3. Commit pending UX work (comment bubble + thread cards) if still dirty.
4. Implement **ViewFocus toggle** (slice 4).
5. Then outline / stepper / filter (slice 5).

### Quick how to try

1. `pnpm build` (or `pnpm dev`), reload unpacked `dist/` in Chrome (ID `knlaahnhnocjejneaobpbbnfibfnoiei`)
2. Settings: try OAuth first, or paste a classic PAT (`repo`) if the org blocks the app
3. Open a PR Files page with a Markdown change
4. Turn on **Rich Markdown view**
5. Select text → Comment → Add comment

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
- Loading secrets from `.env` into the extension (Settings paste only)
