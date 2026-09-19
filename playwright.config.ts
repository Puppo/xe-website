import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  fullyParallel: true,
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  reporter: process.env.CI ? 'github' : 'list',
  retries: process.env.CI ? 2 : 0,
  testDir: './tests/e2e',
  timeout: 60_000,
  use: {
    baseURL: 'http://127.0.0.1:4325',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'python3 -m http.server 4325 --bind 127.0.0.1 --directory dist',
    reuseExistingServer: false,
    url: 'http://127.0.0.1:4325',
  },
  workers: process.env.CI ? 2 : 1,
});
