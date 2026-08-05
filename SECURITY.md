# Security Policy

## Supported versions

Security fixes target the latest code on `main` and the current release version when releases exist.

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Email the maintainer via the contact listed on the [GitHub repository](https://github.com/hedger-briskteaching/markdup), or use [GitHub private vulnerability reporting](https://github.com/hedger-briskteaching/markdup/security/advisories/new) if it is enabled for this repo.

Include steps to reproduce, impact, and any suggested fix if you have one.

## How Markdup handles credentials

- Markdup is a Chrome extension with **no backend server**.
- GitHub access uses either OAuth Device Flow or a personal access token that you paste in Settings.
- The access token is stored in **this browser only** via Chrome extension storage.
- The OAuth **Client ID** is public (normal for native/extension apps). There is **no client secret** in the extension.
- Host permissions are limited to `github.com` and `api.github.com`, plus the `storage` permission.

If you believe a token was exposed through Markdup, revoke it in GitHub settings and remove it from Markdup Settings.
