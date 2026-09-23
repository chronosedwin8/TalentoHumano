import { defineConfig, devices } from '@playwright/test';

const WEB_URL = process.env.E2E_WEB_URL ?? 'http://localhost:5173';
const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3000';

/**
 * Browser flows over a running stack. The API and the database must be up and
 * seeded with the demo company (`pnpm seed:demo`); `webServer` starts the web
 * app unless one is already listening.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: WEB_URL,
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // El portal del colaborador se usa sobre todo desde el telefono.
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /portal\.spec/ },
  ],
  webServer: {
    command: 'pnpm dev',
    url: WEB_URL,
    reuseExistingServer: true,
    timeout: 120_000,
    env: { VITE_API_URL: API_URL },
  },
});
