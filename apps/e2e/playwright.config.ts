import { defineConfig, devices } from '@playwright/test';

// The screen size the store PCs use.
const viewport = { width: 1366, height: 768 };

/**
 * Runs against the Docker Compose stack, which must already be up. Chrome and Edge are the
 * installed browsers (channels), not Playwright's bundled Chromium.
 */
export default defineConfig({
  testDir: './tests',
  // One worker: signing out ends every session of that user, so tests must not overlap.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // The dev server compiles pages on first request, which is slow on a bind mount.
  timeout: 60_000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    locale: 'th-TH',
    timezoneId: 'Asia/Bangkok',
    // Traces can't be written to a Windows bind mount (EPERM), so only CI records them.
    trace: process.env.CI ? 'retain-on-failure' : 'off',
  },
  projects: [
    { name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport } },
    { name: 'edge', use: { ...devices['Desktop Edge'], channel: 'msedge', viewport } },
  ],
});
