import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

// During development we run Vite on 5173 and proxy /api + /style.css fonts
// to the dashboard backend (3420). Once parity is reached the backend will
// serve the build artefact directly via WEB_DIR=web-react/dist.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3420',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
