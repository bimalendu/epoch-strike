// Playwright runs the real game in real browsers: `npm run e2e` (all projects) or `npm run e2e -- --project=chromium`.
// The specs live in tests/e2e/browser and are never picked up by `node --test` (they end in .spec.js).
// Point BASE_URL at a deployed copy (the Pages smoke job does) to skip the local server.
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT || 4173);
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: 'tests/e2e/browser',
  testMatch: '*.spec.js',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  // baselines are the same on every OS (the specs screenshot the canvas, not the page), so no platform suffix
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}{ext}',
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.001 },
  },
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: `node tools/serve.mjs`,
        env: { PORT: String(PORT) },
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
      },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    // phone: coarse pointer + touch, so the on-screen controls show
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
