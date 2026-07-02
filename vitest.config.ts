import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['**/*.test.{ts,tsx}', '**/*.test-d.{ts,tsx}'],
    exclude: ['node_modules', 'dist'],
    setupFiles: ['./tests/setup.ts'],
    typecheck: {
      enabled: true,
      tsconfig: './tsconfig.json',
      include: ['**/*.{test,spec}-d.ts', '**/*.test-d.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});