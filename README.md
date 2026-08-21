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
  <a href="#develop-from-source">Develop</a> ·
  <a href="#forking-markdup">Forking</a> ·
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

|                               |                                                                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Rendered Before / After**   | Formatted Markdown on both sides of the diff, not only source.                                                                 |
| **Aligned blocks**            | Top-level sections stay matched, so moves and edits stay clear.                                                                |
| **Collapsed unchanged text**  | Stable sections start folded. When you need context, expand them.                                                              |
| **Comments on rendered text** | You can select text in the rich view and leave a review comment.                                                               |
| **Local GitHub access**       | OAuth or a personal access token. The token stays in the extension’s private storage (`chrome.storage.local`) on this browser. |

Markdup runs on the pull request **Files changed** page. It targets `.md` and `.markdown` files.

---

## Getting started

Download a prebuilt zip from [GitHub Releases](https://github.com/hedger-briskteaching/markdup/releases) and load it in Chrome. Full steps: [releases/README.md](releases/README.md).

To build or contribute instead, see [Develop from source](#develop-from-source).

### Settings and GitHub access

1. Pin Markdup to the Chrome toolbar so the icon stays visible: open the Extensions puzzle-piece menu, find **Markdup**, and click the pin.
2. Click the Markdup toolbar icon <img src="public/icons/icon-32.png" alt="Markdup" width="20" height="20" />.
3. Click **Open Settings**.
4. Choose one path:
   - **Option 1:** Connect with GitHub (OAuth Device Flow)
   - **Option 2:** Paste a personal access token (classic `repo`, or fine-grained with contents and pull request write)

Both paths store one access token in the extension’s private storage on this browser only. Markdup has no server that keeps your token. If your organization blocks the Markdup OAuth App, use a personal access token.

---

## Use the extension

1. Open a pull request **Files changed** page on GitHub
   (`…/pull/<n>/changes` or classic `…/pull/<n>/files`).
2. On a changed `.md` file, turn on the **Markdup** switch in the file header.
3. Click the extension icon in the Chrome toolbar to open the popup (or Settings).

If the switch does not appear:

- Make sure that you are on the PR Files / Changes URL (not Conversation or Commits).
- Make sure that the file is Markdown (`.md` / `.markdown`).
- On `chrome://extensions`, click the refresh icon on the extension card after you reload a new unzipped release.

---

## Privacy

Markdup has **no backend**. Your GitHub token (OAuth or personal access token) is stored only in this extension’s private Chrome storage (`chrome.storage.local`) — not in cookies, not in the page’s `localStorage`, and not on any Markdup server. Web pages cannot read it. The OAuth Client ID is public; the extension does not ship a client secret. See [SECURITY.md](SECURITY.md) for how to report vulnerabilities.

---

## Develop from source

<details>
<summary>Build from source, scripts, project layout, and contributing</summary>

Use this section when you want to develop Markdup or build it yourself. End users can skip it and [install from a release](#getting-started).

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

Then continue with [Settings and GitHub access](#settings-and-github-access).

The manifest includes a fixed public `key`, so the extension ID is always:

`knlaahnhnocjejneaobpbbnfibfnoiei`

GitHub OAuth callback URL (Device Flow / identity):

`https://knlaahnhnocjejneaobpbbnfibfnoiei.chromiumapp.org/`

OAuth **Client ID** (public) lives in [`src/shared/githubAuth.ts`](src/shared/githubAuth.ts). Device Flow is enabled on the Markdup OAuth App. The extension does not hold a client secret.

If you rebuild the extension, remove any old unpacked Markdup install. Then load `dist/` again so Chrome uses the new ID.

### Development with hot reload

While `pnpm dev` is running:

- Changes under `src/popup/` and `src/content/` usually update automatically.
- After you change `manifest.config.ts` (permissions, matches, and more), click the refresh icon on the extension card in `chrome://extensions`.

### Production build

```bash
pnpm build
```

This command type-checks and writes an optimized bundle to `dist/`. Load that folder with **Load unpacked** the same way as in development. You can also refresh the existing unpacked extension.

### Scripts

| Command              | Description                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| `pnpm dev`           | Dev server with hot reload (output in `dist/`)                                                         |
| `pnpm build`         | Production build into `dist/`                                                                          |
| `pnpm type-check`    | TypeScript check only                                                                                  |
| `pnpm test`          | Run unit tests                                                                                         |
| `pnpm test:coverage` | Unit tests with a coverage summary                                                                     |
| `pnpm package`       | Type-check, test, build, and zip into `releases/release-X.Y.Z/` (requires `releases/release-notes.md`) |
| `pnpm release`       | Patch-bump version, package, and print publish steps                                                   |

### Project layout

| Path                         | Purpose                                                                                  |
| ---------------------------- | ---------------------------------------------------------------------------------------- |
| `manifest.config.ts`         | Manifest V3 (GitHub host permissions + content script)                                   |
| `src/popup/`                 | Toolbar popup UI                                                                         |
| `src/options/`               | Settings page (GitHub connect)                                                           |
| `src/content/`               | UI injected into GitHub pages                                                            |
| `src/background/`            | Service worker and GitHub auth                                                           |
| `src/markdown/`              | Markdown → ProseMirror schema, align, and transform                                      |
| `docs/markdown-schema.md`    | Schema and transform notes                                                               |
| `docs/rich-markdown-view.md` | Rich Before/After view notes                                                             |
| `docs/demo.mp4`              | Local copy of the product demo (README embeds the GitHub-hosted upload)                  |
| `public/icons/`              | Extension icons                                                                          |
| `brand/`                     | Logo and brand assets                                                                    |
| `releases/`                  | Install-from-zip docs and `release-notes.md` (downloadable zips live on GitHub Releases) |
| `scripts/`                   | Package and release helpers                                                              |
| `dist/`                      | Built extension (load this in Chrome)                                                    |

### Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Please follow the [Code of Conduct](CODE_OF_CONDUCT.md).

</details>

---

## Forking Markdup

<details>
<summary>New extension ID, OAuth App, and branding for your fork</summary>

If you fork this repo to ship your own extension (or a long-lived private build), do **not** keep Markdup’s extension ID, OAuth Client ID, or branding. Unpacked installs share the ID from the manifest `key`. Reusing Markdup’s key collides with the official extension and its GitHub OAuth App.

### 1. Generate a new stable extension ID

Chrome derives the extension ID from an RSA public key. Put that public key in the manifest `key` field so every unpacked load gets the same ID.

```bash
# Private key — keep local; do not commit
openssl genrsa 2048 | openssl pkcs8 -topk8 -nocrypt -out brand/extension-private.pem

# Base64 public key for manifest.config.ts → key
openssl rsa -in brand/extension-private.pem -pubout -outform DER | openssl base64 -A

# Extension ID (32 chars, a–p alphabet)
openssl rsa -in brand/extension-private.pem -pubout -outform DER \
  | shasum -a 256 \
  | head -c32 \
  | tr '0-9a-f' 'a-p'
```

Then:

1. Paste the base64 public key into `manifest.config.ts` as `key` (replace the existing value).
2. Update `EXTENSION_ID` in [`src/shared/githubAuth.ts`](src/shared/githubAuth.ts) to the ID from the last command.
3. Optionally save the public key string in `brand/extension-public-key.txt` for your own notes (see [brand/README.md](brand/README.md)).
4. Rebuild, remove any old unpacked install, and load `dist/` again. Confirm the ID on `chrome://extensions`.

Keep `brand/extension-private.pem` out of git. You only need it if you pack or resign a `.crx` yourself.

### 2. Register a GitHub OAuth App (if you want Connect with GitHub)

Markdup’s Client ID only works for the official extension ID. For your fork, create your own [GitHub OAuth App](https://github.com/settings/developers):

1. **Homepage URL** — your fork or product page.
2. **Authorization callback URL** —  
   `https://<your-extension-id>.chromiumapp.org/`  
   (same host Chrome uses for extension identity / Device Flow).
3. Enable **Device Flow** on the OAuth App (Markdup does not use a client secret).
4. Put the new **Client ID** in `GITHUB_OAUTH_CLIENT_ID` in [`src/shared/githubAuth.ts`](src/shared/githubAuth.ts). Never add a client secret to the repo.

Personal access tokens in Settings still work without your own OAuth App.

### 3. Change the logo and icons

Replace Markdup’s brand so users do not confuse your build with the original:

| Path                                                   | Use                                            |
| ------------------------------------------------------ | ---------------------------------------------- |
| `brand/markdup-logo.png`, `brand/markdup-logo-512.png` | Product / OAuth App logo                       |
| `public/icons/logo.svg`                                | README and in-product mark                     |
| `public/icons/icon-*.png`                              | Chrome toolbar and `chrome://extensions` icons |

Update the extension `name` / `description` in `manifest.config.ts` if you rename the product. Then rebuild so `dist/` picks up the new assets.

</details>

---

<p align="center">
  <sub>Built with Vite, CRXJS, React, TypeScript, and Tailwind CSS. · <a href="LICENSE">MIT</a></sub>
</p>
