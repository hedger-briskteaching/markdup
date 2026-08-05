#!/usr/bin/env bash
# Always bump Markdup version, package the extension zip, and print GitHub Release steps.
# Does not create a tag or upload unless you run the printed commands yourself.
#
# Usage:
#   pnpm release                 # patch bump (0.1.0 → 0.1.1), then package
#   pnpm release -- minor        # minor bump (0.1.0 → 0.2.0), then package
#   pnpm release -- major        # major bump (0.1.0 → 1.0.0), then package
#   pnpm release -- 0.2.0        # set exact version, then package
#   bash scripts/release.sh patch
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# pnpm may forward a literal "--" before the bump arg (pnpm release -- 0.1.1).
ARGS=()
for arg in "$@"; do
  if [[ "$arg" != "--" ]]; then
    ARGS+=("$arg")
  fi
done
BUMP_ARG="${ARGS[0]:-patch}"

CURRENT="$(node -p "require('./package.json').version")"

NEW_VERSION="$(node -e "
  const current = process.argv[1];
  const arg = process.argv[2];
  const parts = current.split('.').map((n) => Number(n));
  if (parts.length !== 3 || parts.some((n) => !Number.isInteger(n) || n < 0)) {
    console.error('Current version must be X.Y.Z (got: ' + current + ')');
    process.exit(1);
  }
  let [major, minor, patch] = parts;
  if (arg === 'patch') {
    patch += 1;
  } else if (arg === 'minor') {
    minor += 1;
    patch = 0;
  } else if (arg === 'major') {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (/^[0-9]+\\.[0-9]+\\.[0-9]+$/.test(arg)) {
    process.stdout.write(arg);
    process.exit(0);
  } else {
    console.error('Usage: pnpm release [-- patch|minor|major|X.Y.Z]');
    console.error('Got: ' + arg);
    process.exit(1);
  }
  process.stdout.write([major, minor, patch].join('.'));
" "$CURRENT" "$BUMP_ARG")"

if [[ "$NEW_VERSION" == "$CURRENT" ]]; then
  echo "error: new version must differ from current (${CURRENT})" >&2
  exit 1
fi

echo "==> Bumping version ${CURRENT} → ${NEW_VERSION}"
node -e "
  const fs = require('fs');
  const version = process.argv[1];
  const pkgPath = 'package.json';
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.version = version;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

  const manifestPath = 'manifest.config.ts';
  let manifest = fs.readFileSync(manifestPath, 'utf8');
  const next = manifest.replace(/version:\\s*'[^']+'/, \"version: '\" + version + \"'\");
  if (next === manifest) {
    console.error('Could not update version in manifest.config.ts');
    process.exit(1);
  }
  fs.writeFileSync(manifestPath, next);
" "$NEW_VERSION"

VERSION="$NEW_VERSION"
ZIP_PATH="releases/release-${VERSION}/markdup-${VERSION}.zip"
TAG="v${VERSION}"

bash scripts/package-extension.sh

echo ""
echo "==> Package ready: ${ZIP_PATH}"
echo ""
echo "Publish checklist (run when you are ready to cut the GitHub Release):"
echo ""
echo "  1. Commit the version bump (do not commit ${ZIP_PATH}):"
echo "       git add package.json manifest.config.ts"
echo "       git commit -m \"Release ${TAG}\""
echo ""
echo "  2. Tag and push:"
echo "       git tag ${TAG}"
echo "       git push origin HEAD ${TAG}"
echo ""
echo "  3. Create the GitHub Release and attach the zip:"
echo "       gh release create ${TAG} ${ZIP_PATH} \\"
echo "         --title \"${TAG}\" \\"
echo "         --notes-file releases/release-notes.md"
echo ""
