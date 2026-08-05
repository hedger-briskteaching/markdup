# Install Markdup from a release

Use this path when you want the extension **without** Node.js or pnpm.

## Download

1. Open [GitHub Releases](https://github.com/hedger-briskteaching/markdup/releases).
2. Download `markdup-X.Y.Z.zip` from the latest release (for example `markdup-0.1.0.zip`).

If no release exists yet, build from source instead: see [Getting started](../README.md#getting-started) in the root README (`pnpm install`, `pnpm build`, then load `dist/`).

## Load in Chrome

1. Unzip the file. You should see `manifest.json` at the top of the unzipped folder.
2. Open Chrome and go to `chrome://extensions`.
3. Turn on **Developer mode** (toggle in the top-right).
4. Click **Load unpacked**.
5. Select the unzipped folder (the one that contains `manifest.json`).
6. Make sure that **Markdup** appears in the extensions list and is enabled.

The extension ID is stable for all installs that use the shipped public key:

`knlaahnhnocjejneaobpbbnfibfnoiei`

## Connect GitHub

1. Click the Markdup icon in Chrome.
2. Click **Open Settings**.
3. Choose one path:
   - **Option 1:** Connect with GitHub (OAuth Device Flow)
   - **Option 2:** Paste a personal access token (classic `repo`, or fine-grained with contents and pull request write)

See the [root README](../README.md#settings-and-github-access) for details.

## Update to a new version

1. Download the newer `markdup-X.Y.Z.zip` from [Releases](https://github.com/hedger-briskteaching/markdup/releases).
2. Unzip it (replace or use a new folder).
3. On `chrome://extensions`, click the refresh icon on the Markdup card, or remove the old install and **Load unpacked** again pointing at the new folder.
