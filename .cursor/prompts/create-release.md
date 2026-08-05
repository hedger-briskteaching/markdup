# Create a Markdup release

Use this checklist when the user asks to cut a new release. Host the zip on **GitHub Releases** only. Do **not** commit zip binaries under `releases/release-*/` (they are gitignored).

## Preconditions

1. Confirm the bump type (default **patch**) or an exact target version (for example `0.2.0`).
2. Work from a clean tree on the intended branch (usually `main`), or commit/stash unrelated changes first.
3. Make sure `gh` is authenticated if you will publish (`gh auth status`).

## Steps

1. **Bump and package** (always bumps; default is patch)
   - Patch: `pnpm release` (for example `0.1.0` → `0.1.1`)
   - Minor / major: `pnpm release -- minor` or `pnpm release -- major`
   - Exact version: `pnpm release -- X.Y.Z`
   - Updates `package.json` and `manifest.config.ts`, then packages
   - Use `pnpm package` only when you need a zip of the **current** version without bumping
2. **Verify the zip**
   - Path: `releases/release-X.Y.Z/markdup-X.Y.Z.zip`
   - `unzip -l releases/release-X.Y.Z/markdup-X.Y.Z.zip | head` must show `manifest.json` at the archive root (not nested under `dist/`).
3. **Commit the version bump only**
   - Stage `package.json` and `manifest.config.ts` (and docs if you changed install links).
   - Do **not** stage `releases/release-*/` zips.
   - Commit message style: `Release vX.Y.Z`
4. **Tag and push**
   - `git tag vX.Y.Z`
   - `git push origin HEAD vX.Y.Z`
5. **Create the GitHub Release**
   - Attach the local zip:

     ```bash
     gh release create vX.Y.Z releases/release-X.Y.Z/markdup-X.Y.Z.zip \
       --title "vX.Y.Z" \
       --notes "Markdup vX.Y.Z. Download markdup-X.Y.Z.zip and follow releases/README.md to install."
     ```

6. **Docs**
   - Install steps live in `releases/README.md`. Update them only if the install path changed.
   - Root `README.md` should keep linking to `releases/README.md` and GitHub Releases.

## Do not

- Commit `releases/release-*/markdup-*.zip`
- Skip `pnpm type-check` / `pnpm test` / `pnpm build` (the package script runs them)
- Leave `package.json` and `manifest.config.ts` on different versions
- Publish to the Chrome Web Store unless the user explicitly asks

## Scripts reference

| Command | Purpose |
| --- | --- |
| `pnpm package` | Type-check, test, build, zip current version (no bump) |
| `pnpm release` | Patch-bump, package, print publish commands |
| `pnpm release -- minor` | Minor-bump, package, print publish commands |
| `pnpm release -- major` | Major-bump, package, print publish commands |
| `pnpm release -- X.Y.Z` | Set version to `X.Y.Z`, package, print publish commands |
