import { defineConfig, devices } from '@playwright/test';

// Runs against the docker compose stack (`docker compose up --watch`), not a
// server of its own: see the root README.md.
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list']],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /touch\.spec/,
    },
    {
      name: 'phone',
      use: { ...devices['Pixel 7'] },
      testMatch: /touch\.spec/,
    },
  ],
});
