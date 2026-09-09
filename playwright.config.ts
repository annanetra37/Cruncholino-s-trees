import { defineConfig, devices } from '@playwright/test';

const PORT = Number.parseInt(process.env.E2E_PORT ?? '3210', 10);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

/**
 * T10.3 — the two critical paths, in a real browser.
 *
 * Runs against `next dev` so the dev-login provider is available; signing in
 * through a real magic-link mailbox would test the email provider, not this
 * app. The capture flow is exercised on a phone-sized viewport because that is
 * the only place it is ever used.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['html'], ['list']] : 'list',
  timeout: 60_000,
  use: {
    baseURL,
    trace: 'retain-on-failure',
    // Geolocation permission is granted so the capture flow's primary path can
    // be tested; the denied path is covered by its own test.
    permissions: ['geolocation'],
    geolocation: { latitude: 40.1872, longitude: 44.5152 },
    locale: 'en-GB',
  },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'pnpm dev',
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      AUTH_DEV_LOGIN: 'true',
      NODE_ENV: 'development',
      PORT: String(PORT),
      // Auth.js validates the callback origin against AUTH_URL. Inheriting a
      // developer's .env here points it at whatever port they normally use, and
      // every sign-in silently bounces back to /signin.
      AUTH_URL: baseURL,
      AUTH_TRUST_HOST: 'true',
      AUTH_SECRET: process.env.AUTH_SECRET ?? 'e2e-secret-value-at-least-16-chars',
    },
  },
});
