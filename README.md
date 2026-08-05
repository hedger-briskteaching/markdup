<p align="center">
  <img src="public/icons/logo.svg" alt="Markdup" width="160" height="160" />
</p>

<h1 align="center">Markdup</h1>

<p align="center">
  <strong>Review Markdown as a document, not as source lines.</strong>
</p>

<p align="center">
  A Chrome extension for GitHub pull requests.<br />
  Markdup shows a rendered Before / After view of changed <code>.md</code> files.
</p>

<p align="center">
  <a href="https://github.com/hedger-briskteaching/markdup/actions/workflows/ci.yml"><img src="https://github.com/hedger-briskteaching/markdup/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License" /></a>
  <img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg" alt="Node.js 20+" />
  <img src="https://img.shields.io/badge/typescript-5.8-blue.svg" alt="TypeScript" />
</p>

<p align="center">
  <a href="#demo">Demo</a> ·
  <a href="#why-markdup">Why Markdup</a> ·
  <a href="#what-you-get">What you get</a> ·
  <a href="#getting-started">Getting started</a> ·
  <a href="#use-the-extension">Use the extension</a> ·
  <a href="#privacy">Privacy</a> ·
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

---

## Demo

https://github.com/user-attachments/assets/00826144-6cc4-4e03-87db-6a7929987911

---

## Why Markdup

GitHub shows Markdown diffs as raw source. A small edit can look like a wall of `#`, `-`, and table pipes.

You review docs, READMEs, RFCs, and design notes as documents. Source diffs hide structure. Markdup restores it.

Markdup loads the file at the pull request base and head. Then it aligns blocks and shows each side as formatted Markdown. You read the change the way a reader will see it.

---

## What you get

| | |
| --- | --- |
| **Rendered Before / After** | Formatted Markdown on both sides of the diff, not only source. |
| **Aligned blocks** | Top-level sections stay matched, so moves and edits stay clear. |
| **Collapsed unchanged text** | Stable sections start folded. When you need context, expand them. |
| **Comments on rendered text** | You can select text in the rich view and leave a review comment. |
| **Local GitHub access** | OAuth or a personal access token. The token stays in this browser. |

Markdup runs on the pull request **Files changed** page. It targets `.md` and `.markdown` files.

---

## Privacy

Markdup has **no backend**. Your GitHub token (OAuth or personal access token) stays in this browser via Chrome extension storage. The OAuth Client ID is public; the extension does not ship a client secret. See [SECURITY.md](SECURITY.md) for how to report vulnerabilities.

---

## Getting started

Pick **one** path below. You do not need both.

### Option A — Install from a release zip

No Node.js required. Download a prebuilt zip from [GitHub Releases](https://github.com/hedger-briskteaching/markdup/releases) and load it in Chrome. Full steps: [releases/README.md](releases/README.md).

Then continue with [Settings and GitHub access](#settings-and-github-access).

### Option B — Build from source

Use this path when you want to develop Markdup or build it yourself.

**Requirements**

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 10+

```bash
npm install -g pnpm
pnpm install
pnpm build
```

For day-to-day development with hot reload, use `pnpm dev` instead of `pnpm build`. Keep that process open while you work; it writes the extension into `dist/`.

**Load the extension in Chrome**

1. Open Chrome and go to `chrome://extensions`.
2. Turn on **Developer mode** (toggle in the top-right).
3. Click **Load unpacked**.
4. Select the `dist` folder of this project.
5. Make sure that **Markdup** appears in the extensions list and is enabled.

The manifest includes a fixed public `key`, so the extension ID is always:

`knlaahnhnocjejneaobpbbnfibfnoiei`

GitHub OAuth callback URL (Device Flow / identity):

`https://knlaahnhnocjejneaobpbbnfibfnoiei.chromiumapp.org/`

OAuth **Client ID** (public) lives in [`src/shared/githubAuth.ts`](src/shared/githubAuth.ts). Device Flow is enabled on the Markdup OAuth App. The extension does not hold a client secret.

If you rebuild the extension, remove any old unpacked Markdup install. Then load `dist/` again so Chrome uses the new ID.

### Settings and GitHub access

1. Click the Markdup icon in Chrome.
2. Click **Open Settings**.
3. Choose one path:
   - **Option 1:** Connect with GitHub (OAuth Device Flow)
   - **Option 2:** Paste a personal access token (classic `repo`, or fine-grained with contents and pull request write)
4. Click **Remove from this browser** to delete the local token.

Both paths store one access token in this browser only. Markdup has no server that keeps your token. If your organization blocks the Markdup OAuth App, use a personal access token.

---

## Use the extension

1. Open a pull request **Files changed** page on GitHub
   (`…/pull/<n>/changes` or classic `…/pull/<n>/files`).
2. On a changed `.md` file, turn on the **Markdup** switch in the file header.
3. Click the extension icon in the Chrome toolbar to open the popup (or Settings).

If the switch does not appear:

- Make sure that you are on the PR Files / Changes URL (not Conversation or Commits).
- Make sure that the file is Markdown (`.md` / `.markdown`).
- If you built from source, make sure that `pnpm build` (or `pnpm dev`) has produced a `dist/` folder.
- On `chrome://extensions`, click the refresh icon on the extension card after you rebuild or reload a new unzipped release.

### Development with hot reload

While `pnpm dev` is running:

- Changes under `src/popup/` and `src/content/` usually update automatically.
- After you change `manifest.config.ts` (permissions, matches, and more), click the refresh icon on the extension card in `chrome://extensions`.

### Production build

```bash
pnpm build
```

This command type-checks and writes an optimized bundle to `dist/`. Load that folder with **Load unpacked** the same way as in development. You can also refresh the existing unpacked extension.

---

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Dev server with hot reload (output in `dist/`) |
| `pnpm build` | Production build into `dist/` |
| `pnpm type-check` | TypeScript check only |
| `pnpm test` | Run unit tests |
| `pnpm test:coverage` | Unit tests with a coverage summary |
| `pnpm package` | Type-check, test, build, and zip into `releases/release-X.Y.Z/` |
| `pnpm release` | Patch-bump version, package, and print publish steps |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Please follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Project layout

| Path | Purpose |
| --- | --- |
| `manifest.config.ts` | Manifest V3 (GitHub host permissions + content script) |
| `src/popup/` | Toolbar popup UI |
| `src/options/` | Settings page (GitHub connect) |
| `src/content/` | UI injected into GitHub pages |
| `src/background/` | Service worker and GitHub auth |
| `src/markdown/` | Markdown → ProseMirror schema, align, and transform |
| `docs/markdown-schema.md` | Schema and transform notes |
| `docs/rich-markdown-view.md` | Rich Before/After view notes |
| `docs/demo.mp4` | Local copy of the product demo (README embeds the GitHub-hosted upload) |
| `public/icons/` | Extension icons |
| `brand/` | Logo and brand assets |
| `releases/` | Install-from-zip docs (downloadable zips live on GitHub Releases) |
| `scripts/` | Package and release helpers |
| `dist/` | Built extension (load this in Chrome) |

---

<p align="center">
  <sub>Built with Vite, CRXJS, React, TypeScript, and Tailwind CSS. · <a href="LICENSE">MIT</a></sub>
</p>
