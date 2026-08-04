# Brand assets

- `markdup-logo.png` / `markdup-logo-512.png` — product logo (OAuth app + marketing)
- `extension-public-key.txt` — public key embedded as manifest `key` (stable extension ID)
- `extension-private.pem` — **not committed**; keep local for packing/signing a CRX if needed

## Stable extension ID

With the public `key` in `manifest.config.ts`:

- **ID:** `knlaahnhnocjejneaobpbbnfibfnoiei`
- **OAuth callback:** `https://knlaahnhnocjejneaobpbbnfibfnoiei.chromiumapp.org/`
- **Client ID:** `Ov23ligHmXvOghPDOSCF` (also in `src/shared/githubAuth.ts`)
