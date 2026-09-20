import { defineConfig, devices } from '@playwright/test';

const PORT = 4300;

/** End-to-end tests run against the dev server with the GitHub API fully mocked. Firefox only. */
export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.e2e\.spec\.ts$/,
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'firefox', use: { ...devices['Desktop Firefox'] } }],
  webServer: {
    command: `pnpm exec ng serve --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env['CI'],
    timeout: 180_000,
  },
});
