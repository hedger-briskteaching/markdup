# Contributing to Markdup

Thanks for helping improve Markdup.

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 10+

```bash
pnpm install
pnpm dev
```

Load the unpacked extension from the `dist/` folder in Chrome (`chrome://extensions` → Developer mode → Load unpacked). See the [README](README.md) for OAuth / PAT setup.

## Development

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Dev server with hot reload (writes `dist/`) |
| `pnpm type-check` | TypeScript check |
| `pnpm test` | Unit tests |
| `pnpm test:coverage` | Unit tests with coverage summary |
| `pnpm build` | Production build |

After you change `manifest.config.ts`, refresh the extension card on `chrome://extensions`.

## Pull requests

1. Keep changes focused on one concern.
2. Add or update tests when behavior changes.
3. Make sure `pnpm type-check`, `pnpm test`, and `pnpm build` pass locally.
4. For UI or content-script changes, smoke-test on a real GitHub PR **Files changed** page.
5. Use the PR template checklist.

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).
