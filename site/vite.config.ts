import { defineConfig } from 'vite';

/** Project Pages mount at /xatlas-wasm/; local dev and preview stay at /. */
const base = process.env.SITE_BASE ?? '/';

export default defineConfig({
  base,
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    exclude: ['xatlas-wasm'],
  },
  server: {
    fs: {
      allow: ['..'],
    },
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
    // The lazy demo-page chunk contains three.js; it is not on the gallery path.
    chunkSizeWarningLimit: 650,
  },
});
