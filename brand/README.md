# Brand assets

- `markdup-logo.png` / `markdup-logo-512.png` — product logo (OAuth app + marketing)
- `extension-public-key.txt` — public key embedded as manifest `key` (stable extension ID)
- `extension-private.pem` — **not committed**; keep local. Used by `pnpm package` to write `markdup-X.Y.Z-store.zip` (Chrome Web Store first upload) and to pack or resign a CRX if needed. Do not regenerate unless you intend to change the extension ID — the public key cannot recreate this file.

## Stable extension ID

With the public `key` in `manifest.config.ts`:

- **ID:** `knlaahnhnocjejneaobpbbnfibfnoiei`
- **OAuth callback:** `https://knlaahnhnocjejneaobpbbnfibfnoiei.chromiumapp.org/`
- **Client ID:** `Ov23ligHmXvOghPDOSCF` (also in `src/shared/githubAuth.ts`)
