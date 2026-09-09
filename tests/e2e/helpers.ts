import { expect, type Page } from '@playwright/test';

/**
 * Signs in through the dev-login provider, so the tests exercise the app's real
 * session and role handling rather than a stubbed cookie.
 */
export async function signIn(page: Page, email = 'contributor@example.org') {
  await page.goto('/signin');
  await page.getByLabel('Email address').fill(email);
  await page.getByRole('button', { name: /sign in|email me/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/signin'), { timeout: 30_000 });
}

/**
 * The filter panel is a sidebar on desktop and a bottom sheet behind a
 * "Filters" button on a phone. Tests drive it the way a user would rather than
 * assuming one of the two layouts.
 */
export async function openFilters(page: Page) {
  const toggle = page.getByRole('button', { name: 'Filters' });
  if (await toggle.isVisible()) await toggle.click();
  await expect(page.getByRole('heading', { name: 'Filters' })).toBeVisible();
}

/**
 * Clicks the language switcher and waits for the reload it triggers.
 *
 * The switcher writes a cookie and reloads the whole document, because the
 * locale reaches server components, the metadata and `<html lang>` — none of
 * which a client re-render would update. Waiting for `lang` to flip is waiting
 * for that reload to land, and is more honest than a fixed sleep.
 */
export async function switchLanguage(page: Page, locale: 'en' | 'hy') {
  // Keyed on the button's `lang` attribute rather than its label. Matching by
  // accessible name is a trap here: Playwright matches names case-insensitively
  // as substrings, so "EN" also matches Next's "Open Next.js Dev Tools" button
  // in development — a strict-mode violation that surfaces as a click silently
  // never happening.
  const button = page.locator(`header button[lang="${locale}"]`);

  // The click is retried rather than issued once. Playwright considers a button
  // clickable as soon as it is painted, but the switcher's handler only exists
  // after React hydrates — and the page immediately before this call is one the
  // switcher itself just reloaded. A single click can land on markup that is
  // not yet wired up and do nothing at all. Retrying is also what a real person
  // does when a tap appears to be ignored.
  await expect(async () => {
    await button.click();
    await expect(page.locator('html')).toHaveAttribute('lang', locale, { timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
}
