import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: 'pnpm preview --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 60_000
  },
  projects: [
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'], channel: 'chrome', viewport: { width: 360, height: 800 } } }
  ]
});
