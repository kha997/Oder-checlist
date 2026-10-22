import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Deliberately separate from vite.config.ts: the PWA service-worker plugin and
// the dev-server/HMR config are irrelevant to unit tests, and loading them
// would slow the run and pull in browser-only assumptions.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, '.'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    reporters: ['default'],
  },
});
