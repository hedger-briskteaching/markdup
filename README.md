# Markdup

Rich Markdown review for pull requests — **markdown** source, **markup** preview.

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

### Use the extension

1. Open any page on [github.com](https://github.com)
2. You should see a small **Markdup — active** badge in the bottom-right corner of the page
3. Click the extension icon in the Chrome toolbar to open the popup

If the badge does not appear:

- Make sure `pnpm dev` (or a completed `pnpm build`) has produced a `dist/` folder
- On `chrome://extensions`, click the refresh icon on the extension card after rebuilding
- Confirm the site is `https://github.com/...` (the content script only runs on GitHub)

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
| `src/content/` | UI injected into GitHub pages |
| `src/background/` | Service worker stub |
| `public/icons/` | Extension icons |
| `dist/` | Built extension (load this in Chrome) |
