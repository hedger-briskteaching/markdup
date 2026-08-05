/** Chrome extension manifest configuration for Markdup (Manifest V3). */
import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'Markdup',
  description: 'Markdup — A better way to review Markdown files.',
  version: '0.1.1',
  // This public key gives a stable extension ID (knlaahnhnocjejneaobpbbnfibfnoiei) for all unpacked installs.
  // OAuth callback URL: https://knlaahnhnocjejneaobpbbnfibfnoiei.chromiumapp.org/
  key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEApd1viQ3+mOFcr4ykTO40K5tSx+tyToZZQKuOIW1VYDmA8b5TMuK5eQNo4ABlk0D8qMzvTkYdgH8hPnmCzWd8WTBrdLJsLiwuo4EO2IWJ/GOeDFs42x+FB7SbraQK7i+R6YNgTIX4pPipjT+XkaOCxqr/2WbFiEYE6/jLip2jZfJSHw6Xgjvh5utD8J1L6Ii4K7euHRihmzCKnV6rnw9OUiC8br6mxjSBnYwQqttMmcaDK3YRbAFSyJAGS4uKZZfDyXDOkOcpAKAicwdKsLmzJD6XGJ0C+w4sRLpRo7KdW9AyRwoaBdv88g78XkWx0IWcv6TsJdaBGg0EiYW3HWWfkwIDAQAB',
  action: {
    default_popup: 'index.html',
    default_title: 'Markdup',
    default_icon: {
      16: 'icons/icon-16.png',
      48: 'icons/icon-48.png',
      128: 'icons/icon-128.png',
    },
  },
  icons: {
    16: 'icons/icon-16.png',
    48: 'icons/icon-48.png',
    128: 'icons/icon-128.png',
  },
  options_ui: {
    page: 'options.html',
    open_in_tab: true,
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  permissions: ['storage'],
  content_scripts: [
    {
      // Inject on all PR pages so soft navigation from Conversation to Files still works.
      // UI stays gated to /files and /changes in init (isPrFilesPage).
      matches: ['https://github.com/*/pull/*'],
      js: ['src/content/main.tsx'],
      run_at: 'document_idle',
    },
  ],
  host_permissions: ['https://github.com/*', 'https://api.github.com/*'],
})
