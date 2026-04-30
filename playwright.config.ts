import { defineConfig, devices } from 'playwright/test'

/**
 * Playwright configuration — portal smoke tests.
 *
 * Scope: fast end-to-end coverage of flows where the unit-level vitest
 * suite (667/667 green) can't reach — multi-step client UI that owns
 * its own countdown + network dance, like the CRUZ 5-second cancel
 * gate.
 *
 * Not part of `npm run ship`. Run with `npm run test:e2e` explicitly
 * against a local dev server. The suite reuses an already-running
 * `next dev` if one is up (via `reuseExistingServer`); otherwise it
 * boots one for the test run.
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /.*\.spec\.ts/,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'list' : [['list']],
  use: {
    baseURL: process.env.PORTAL_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 5_000,
    navigationTimeout: 10_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: process.env.PORTAL_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 120_000,
        stdout: 'ignore',
        stderr: 'pipe',
      },
})
