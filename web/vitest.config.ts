import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
    coverage: {
      provider: 'v8',
      // Logic and the shared UI kit. Pages and feature components that need a running API and
      // router are exercised by the end-to-end tests instead.
      include: ['src/lib/**/*.ts', 'src/components/ui/**/*.tsx'],
      exclude: ['src/lib/session.ts', 'src/lib/serverApi.ts', 'src/lib/upload.ts'],
      reporter: ['text-summary', 'json-summary'],
      reportsDirectory: 'coverage',
    },
  },
});
