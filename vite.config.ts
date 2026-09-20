import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Ensures relative paths for GitHub Pages
  optimizeDeps: {
    // @jsquash/webp loads its WASM via dynamic import + import.meta.url,
    // which breaks when pre-bundled into .vite/deps (dev-only issue)
    exclude: ['@jsquash/webp']
  }
})
