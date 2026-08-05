#!/usr/bin/env bash
# Build a production zip of the Markdup Chrome extension.
# Output: releases/release-X.Y.Z/markdup-X.Y.Z.zip (contents of dist/, not dist/ itself).
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
  const match = text.match(/version:\\s*'([^']+)'/);
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
rm -f "$ZIP_PATH"

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

echo ""
echo "Created ${ZIP_PATH}"
echo "Notes:  ${OUT_DIR}/release-notes.md"
echo "Verify: unzip -l ${ZIP_PATH} | head  (expect manifest.json at the archive root)"
echo "Next: upload this zip as a GitHub Release asset (see scripts/release.sh)"
