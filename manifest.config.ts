import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'Markdup',
  description:
    'Rich Markdown review for pull requests — markdown source, markup preview.',
  version: '0.1.0',
  // Fixed public key → stable extension ID for all unpacked installs:
  // knlaahnhnocjejneaobpbbnfibfnoiei
  // OAuth callback: https://knlaahnhnocjejneaobpbbnfibfnoiei.chromiumapp.org/
  key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEApd1viQ3+mOFcr4ykTO40K5tSx+tyToZZQKuOIW1VYDmA8b5TMuK5eQNo4ABlk0D8qMzvTkYdgH8hPnmCzWd8WTBrdLJsLiwuo4EO2IWJ/GOeDFs42x+FB7SbraQK7i+R6YNgTIX4pPipjT+XkaOCxqr/2WbFiEYE6/jLip2jZfJSHw6Xgjvh5utD8J1L6Ii4K7euHRihmzCKnV6rnw9OUiC8br6mxjSBnYwQqttMmcaDK3YRbAFSyJAGS4uKZZfDyXDOkOcpAKAicwdKsLmzJD6XGJ0C+w4sRLpRo7KdW9AyRwoaBdv88g78XkWx0IWcv6TsJdaBGg0EiYW3HWWfkwIDAQAB',
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
