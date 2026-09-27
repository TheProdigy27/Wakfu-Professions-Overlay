import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';
import type { Plugin } from 'vite';

/**
 * La CSP de production (dans index.html) interdit les scripts en ligne et les connexions.
 * En développement seulement, Vite a besoin du préambule React en ligne et d'une connexion WebSocket (HMR).
 */
function devCsp(): Plugin {
  return {
    name: 'dev-csp',
    apply: 'serve',
    transformIndexHtml: (html) =>
      html
        .replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")
        .replace("style-src 'self'", "style-src 'self' 'unsafe-inline'")
        .replace("connect-src 'none'", "connect-src 'self' ws:"),
  };
}

export default defineConfig({
  main: {
    build: { rollupOptions: { input: { index: resolve('src/main/index.ts') } } },
  },
  preload: {
    build: {
      // Un preload sandboxé doit être en CommonJS, sans dépendance externe.
      externalizeDeps: false,
      rollupOptions: {
        input: { index: resolve('src/preload/index.ts') },
        output: { format: 'cjs', entryFileNames: '[name].cjs' },
      },
    },
  },
  renderer: {
    root: 'src/renderer',
    plugins: [react(), devCsp()],
    build: { minify: true, rollupOptions: { input: { panel: resolve('src/renderer/panel/index.html') } } },
  },
});
