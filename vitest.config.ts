import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['server/src/__tests__/**/*.test.ts'],
    exclude: ['tests/**', '**/dist/**', 'node_modules/**'],
  },
});
