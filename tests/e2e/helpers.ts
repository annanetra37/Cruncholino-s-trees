import type { Page } from '@playwright/test';

/**
 * Signs in through the dev-login provider. This exists so the tests exercise
 * the app's real session and role handling rather than a stubbed cookie.
 */
export async function signIn(page: Page, email = 'contributor@example.org') {
  await page.goto('/signin');
  await page.getByLabel('Email address').fill(email);
  await page.getByRole('button', { name: /sign in|email me/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/signin'), { timeout: 30_000 });
}
