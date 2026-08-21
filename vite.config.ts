/** Vite build configuration for the Markdup Chrome extension. */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import manifest from './manifest.config'

export default defineConfig({
  plugins: [tailwindcss(), react(), crx({ manifest })],
  build: {
    rollupOptions: {
      input: {
        popup: 'index.html',
        options: 'options.html',
        mermaidFrame: 'mermaidFrame.html',
      },
    },
  },
})
