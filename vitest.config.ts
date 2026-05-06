import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
    // The qa-suite probes live under scripts/test/qa-suite/ but their
    // smoke tests need to be discovered by vitest. Listing both roots
    // keeps the standard src/ pattern + picks up the qa-suite tests.
    // See ~/Desktop/qa-suite-plan-2026-05-06.md B4.
    include: ['src/**/*.test.{ts,tsx}', 'scripts/test/qa-suite/__tests__/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
