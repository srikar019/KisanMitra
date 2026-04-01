/// <reference types="vitest" />
import path from 'path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['./tests/**/*.test.{ts,tsx}'],
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['components/**', 'services/**', 'contexts/**'],
      exclude: ['node_modules', 'dist', 'tests'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  define: {
    'process.env.API_KEY': JSON.stringify('test-api-key'),
    'process.env.GEMINI_API_KEY': JSON.stringify('test-api-key'),
    'process.env.EXA_API_KEY': JSON.stringify('test-exa-key'),
  },
});
