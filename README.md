# Markdup

Markdup — A better way to review Markdown files.

Chrome extension for reviewing `.md` files on GitHub with a rendered Before/After diff. Built with Vite, CRXJS, React, TypeScript, and Tailwind CSS.

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 10+

```bash
npm install -g pnpm
```

## Getting started

```bash
pnpm install
pnpm dev
```

`pnpm dev` starts Vite with hot reload and writes the extension into the `dist/` folder. Keep this process running while you develop.

### Load the extension in Google Chrome

1. Open Chrome and go to `chrome://extensions`
2. Turn on **Developer mode** (toggle in the top-right)
3. Click **Load unpacked**
4. Select this project’s `dist` folder
5. Confirm **Markdup** appears in the extensions list and is enabled

The manifest includes a fixed public `key`, so the extension ID is always:

`knlaahnhnocjejneaobpbbnfibfnoiei`

GitHub OAuth callback URL (Device Flow / identity):

`https://knlaahnhnocjejneaobpbbnfibfnoiei.chromiumapp.org/`

OAuth **Client ID** (public) lives in [`src/shared/githubAuth.ts`](src/shared/githubAuth.ts). Device Flow is enabled on the Markdup OAuth App — no client secret in the extension.

After a rebuild, remove any old unpacked Markdup install and load `dist/` again so Chrome picks up the new ID.

### Settings and GitHub access

1. Click the Markdup icon in Chrome.
2. Click **Open Settings**.
3. Choose either path:
   - **Option 1:** Connect with GitHub (OAuth Device Flow)
   - **Option 2:** Paste a personal access token (classic `repo`, or fine-grained with contents + pull request write)
4. Click **Remove from this browser** to delete the local token.

Both paths store one access token in this browser only. Markdup has no server that keeps your token. Use a PAT when your organization blocks the Markdup OAuth App.

### Use the extension

1. Open a pull request **Files changed** page on GitHub  
   (`…/pull/<n>/changes` or classic `…/pull/<n>/files`)
2. On a changed `.md` file, turn on the **Markdup** switch in the file header
3. Click the extension icon in the Chrome toolbar to open the popup (or Settings)

If the switch does not appear:

- Make sure you are on the PR Files / Changes URL (not Conversation or Commits)
- Make sure the file is Markdown (`.md` / `.markdown`)
- Make sure `pnpm dev` (or a completed `pnpm build`) has produced a `dist/` folder
- On `chrome://extensions`, click the refresh icon on the extension card after rebuilding

### Development with hot reload

While `pnpm dev` is running:

- Changes under `src/popup/` and `src/content/` usually update automatically
- After changing `manifest.config.ts` (permissions, matches, etc.), click the refresh icon on the extension card in `chrome://extensions`

### Production build

```bash
pnpm build
```

This type-checks and writes an optimized bundle to `dist/`. Load that folder with **Load unpacked** the same way as in development (or refresh the existing unpacked extension).

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Dev server with hot reload (output in `dist/`) |
| `pnpm build` | Production build into `dist/` |
| `pnpm type-check` | TypeScript check only |
| `pnpm test` | Run unit tests |

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
| `docs/CONTINUE.md` | Status and next steps after a restart |
| `public/icons/` | Extension icons |
| `dist/` | Built extension (load this in Chrome) |
