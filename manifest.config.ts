import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'Markdup',
  description:
    'Rich Markdown review for pull requests — markdown source, markup preview.',
  version: '0.1.0',
  action: {
    default_popup: 'index.html',
    default_title: 'Markdup',
    default_icon: {
      16: 'icons/icon16.png',
      48: 'icons/icon48.png',
      128: 'icons/icon128.png',
    },
  },
  icons: {
    16: 'icons/icon16.png',
    48: 'icons/icon48.png',
    128: 'icons/icon128.png',
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['https://github.com/*'],
      js: ['src/content/main.tsx'],
      run_at: 'document_idle',
    },
  ],
  host_permissions: ['https://github.com/*'],
})
