import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/social',
  timeout: 30_000,
  retries: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:4200',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'corepack pnpm start:prod:frontend',
    url: 'http://127.0.0.1:4200/auth/login',
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_BACKEND_URL: 'http://127.0.0.1:3000',
      IS_GENERAL: 'true',
    },
  },
});
