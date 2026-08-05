import { defineConfig, configDefaults } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    // Playwright's own spec files (packages/browser/e2e/**) match Vitest's default
    // `**/*.spec.ts` include glob; exclude them so `vitest run` doesn't try to load
    // @playwright/test's test() outside of the Playwright runner (Task 19). Spread
    // configDefaults.exclude rather than replacing it outright -- Vitest's `exclude` option
    // overrides the default array entirely instead of merging with it.
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
})
