#!/usr/bin/env bash
# Build production zips of the Markdup Chrome extension.
# Output (contents of dist/, not dist/ itself):
#   releases/release-X.Y.Z/markdup-X.Y.Z.zip        — GitHub Release (manifest `key` kept)
#   releases/release-X.Y.Z/markdup-X.Y.Z-store.zip  — Chrome Web Store (no `key`; `key.pem` at root)
# The store zip is built only when brand/extension-private.pem is present. It contains
# that private key — first CWS upload only; never attach it to a GitHub Release.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -f package.json ]]; then
  echo "error: run from the markdup repo root (package.json missing)" >&2
  exit 1
fi

PKG_VERSION="$(node -p "require('./package.json').version")"
MANIFEST_VERSION="$(node -e "
  const fs = require('fs');
  const text = fs.readFileSync('manifest.config.ts', 'utf8');
  const match = text.match(/version:\\s*['\"]([^'\"]+)['\"]/);
  if (!match) {
    console.error('Could not find version in manifest.config.ts');
    process.exit(1);
  }
  process.stdout.write(match[1]);
")"

if [[ "$PKG_VERSION" != "$MANIFEST_VERSION" ]]; then
  echo "error: version mismatch: package.json=$PKG_VERSION manifest.config.ts=$MANIFEST_VERSION" >&2
  exit 1
fi

VERSION="$PKG_VERSION"
OUT_DIR="releases/release-${VERSION}"
ZIP_NAME="markdup-${VERSION}.zip"
ZIP_PATH="${OUT_DIR}/${ZIP_NAME}"
STORE_ZIP_NAME="markdup-${VERSION}-store.zip"
STORE_ZIP_PATH="${OUT_DIR}/${STORE_ZIP_NAME}"
PEM_PATH="brand/extension-private.pem"
STORE_STAGE=""

cleanup() {
  if [[ -n "${STORE_STAGE}" && -d "${STORE_STAGE}" ]]; then
    rm -rf "${STORE_STAGE}"
  fi
}
trap cleanup EXIT

echo "==> Packaging Markdup v${VERSION}"
echo "==> Type-check"
pnpm type-check
echo "==> Test"
pnpm test
echo "==> Build"
pnpm build

if [[ ! -f dist/manifest.json ]]; then
  echo "error: dist/manifest.json missing after build" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
rm -f "$ZIP_PATH" "$STORE_ZIP_PATH"

if [[ ! -f releases/release-notes.md ]]; then
  echo "error: releases/release-notes.md missing — write short release notes before packaging" >&2
  exit 1
fi

cp releases/release-notes.md "${OUT_DIR}/release-notes.md"

# Zip contents of dist/ so unzipping yields manifest.json at the root.
(
  cd dist
  zip -r "../${ZIP_PATH}" . -x "*.DS_Store"
)

if [[ ! -f "$PEM_PATH" ]]; then
  echo ""
  echo "Created ${ZIP_PATH}"
  echo "Skipped ${STORE_ZIP_PATH} (missing ${PEM_PATH})"
  echo "Notes:  ${OUT_DIR}/release-notes.md"
  echo "Verify: unzip -l ${ZIP_PATH} | head  (expect manifest.json at the archive root)"
  echo "Next: upload ${ZIP_PATH} as a GitHub Release asset (see scripts/release.sh)"
  exit 0
fi

EXPECTED_ID="$(node -e "
  const fs = require('fs');
  const text = fs.readFileSync('src/shared/githubAuth.ts', 'utf8');
  const match = text.match(/export const EXTENSION_ID = ['\"]([^'\"]+)['\"]/);
  if (!match) {
    console.error('Could not find EXTENSION_ID in src/shared/githubAuth.ts');
    process.exit(1);
  }
  process.stdout.write(match[1]);
")"
DERIVED_ID="$(
  openssl rsa -in "$PEM_PATH" -pubout -outform DER 2>/dev/null |
    shasum -a 256 |
    head -c32 |
    tr '0-9a-f' 'a-p'
)"
if [[ "$DERIVED_ID" != "$EXPECTED_ID" ]]; then
  echo "error: ${PEM_PATH} derives ID ${DERIVED_ID}, expected ${EXPECTED_ID}" >&2
  exit 1
fi

echo "==> Chrome Web Store zip (strip manifest key, add key.pem)"
STORE_STAGE="$(mktemp -d)"
cp -R dist/. "${STORE_STAGE}/"
node -e "
  const fs = require('fs');
  const path = require('path');
  const file = path.join(process.argv[1], 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  delete manifest.key;
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n');
" "${STORE_STAGE}"
cp "$PEM_PATH" "${STORE_STAGE}/key.pem"
(
  cd "${STORE_STAGE}"
  zip -r "${ROOT}/${STORE_ZIP_PATH}" . -x "*.DS_Store"
)

echo ""
echo "Created ${ZIP_PATH}"
echo "Created ${STORE_ZIP_PATH}"
echo "Notes:  ${OUT_DIR}/release-notes.md"
echo "Verify: unzip -l ${ZIP_PATH} | head  (expect manifest.json at the archive root)"
echo "Next: upload ${ZIP_PATH} as a GitHub Release asset (see scripts/release.sh)"
echo "CWS:  upload ${STORE_ZIP_PATH} for the first listing only."
echo "      It contains ${PEM_PATH} as key.pem — do not attach it to GitHub Releases."
echo "      Later CWS updates: zip without key.pem (strip key.pem from the store zip, or"
echo "      strip the manifest key from the GitHub zip if the dashboard still rejects key)."
