import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        // Hors réseau, sur l'extrait tests/fixtures/index-subset.json et des données synthétiques.
        extends: true,
        test: { name: 'unit', include: ['tests/unit/**/*.test.ts'] },
      },
      {
        // Données Ankama réelles (version figée), téléchargées une fois dans .cache/.
        extends: true,
        test: {
          name: 'realdata',
          include: ['tests/realdata/**/*.test.ts'],
          fileParallelism: false,
          testTimeout: 120_000,
          hookTimeout: 300_000,
        },
      },
      {
        // Application construite (npm run build, ou exécutable empaqueté via WPO_E2E_EXE), pilotée par Playwright, hors réseau.
        extends: true,
        test: {
          name: 'e2e',
          include: ['tests/e2e/**/*.test.ts'],
          fileParallelism: false,
          testTimeout: 60_000,
          hookTimeout: 120_000,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      // Code testable hors Electron ; le reste (fenêtres, IPC, renderer) est vérifié dans l'application.
      include: ['src/core/**/*.ts', 'src/main/data/**/*.ts', 'src/main/store/**/*.ts', 'src/main/windows/placement.ts'],
      exclude: ['src/main/data/iconProtocol.ts'],
      reporter: ['text-summary', 'text'],
      thresholds: {
        'src/core/needs/**': { branches: 90 },
      },
    },
  },
});
