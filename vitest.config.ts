import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Domain layer has zero DOM dependencies — plain Node.js is faster
    environment: 'node',

    // Only test the domain layer (see CLAUDE.md — Testing section)
    include: ['src/domain/**/*.test.ts'],

    coverage: {
      provider: 'v8',
      include: ['src/domain/**'],
      exclude: ['src/domain/**/*.test.ts'],
      thresholds: {
        lines:     90,
        functions: 90,
        branches:  85,
        statements: 90,
      },
      reporter: ['text', 'html'],
    },
  },
});
